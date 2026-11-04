import { NextRequest, NextResponse } from 'next/server';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { createLLM } from '@/lib/llm';
import { patientSimulationRules } from '@/lib/patient-types';
import { getKnowledgeBase } from '@/lib/knowledge-base';
import { getRoundTheme, CITY_COMPETITORS, CITY_COMPETITOR_HINTS, replaceGenericHospitalNames } from '@/lib/training-rounds';
import { PROJECT_HOSPITAL_NAMES } from '@/lib/user-info';

// 提取AIMessageChunk中的文本内容（兼容string和array两种格式）
function extractTextFromChunk(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((part: { type?: string }) => part.type === 'text' || !part.type)
      .map((part: { text?: string }) => part.text || '')
      .join('');
  }
  return '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, roundNumber, city } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid messages format' },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const client = createLLM(customHeaders);

    // 获取沟通风格规则
    const rules = patientSimulationRules.communicationStyle;

    // 获取轮次主题（如果有）
    const roundTheme = roundNumber ? getRoundTheme(roundNumber) : null;
    const bodyPart = roundTheme?.suggestedBodyPart || '面部';
    const isConfirmed = roundNumber ? roundNumber >= 2 : true;
    const diagnosisStatus = isConfirmed ? '已确诊白癜风' : '尚未确诊，刚发现白斑来咨询';
    const currentCity = (city as keyof typeof PROJECT_HOSPITAL_NAMES) || null;
    const hospitalName = currentCity ? PROJECT_HOSPITAL_NAMES[currentCity] : '本院';
    const competitors = currentCity ? CITY_COMPETITORS[currentCity] || [] : [];
    const cityHint = currentCity ? CITY_COMPETITOR_HINTS[currentCity] || '' : '';
    // 从竞品列表中选1-2个作为患者去过的医院，写进背景故事
    const visitedHospital = competitors.length > 0 ? competitors[0] : '';
    const comparedHospital = competitors.length > 1 ? competitors[1] : competitors[0] || '';
    const competitorStory = visitedHospital
      ? `\n\n【你的就医经历（真实背景故事）】
你来${hospitalName}咨询之前，已经在${visitedHospital}治疗过${roundNumber && roundNumber >= 5 ? '3个多月' : '1-2个月'}。你在那里做过检查、开过药膏、照过光，花了${roundNumber && roundNumber >= 5 ? '大几千' : '两三千'}块钱，但效果不明显，白斑没什么变化。${comparedHospital && comparedHospital !== visitedHospital ? `你也去过${comparedHospital}咨询过，感觉方案差不多。` : ''}
这就是你的真实经历。你在对话中提到之前看过的医院时，就说${visitedHospital}的名字。提到对比时就说${comparedHospital || visitedHospital}。这就是你实际去过的地方，你只会说自己亲身经历过的医院名字。`
      : '';
    const roundThemeSection = roundTheme
      ? `
【你的情况】
你的基本情况：${roundTheme.patientDirection}
发病部位：${bodyPart}
确诊状态：${diagnosisStatus}
${roundNumber > 1 ? '【开场白规则】你已经确诊了，开场要直接说你的确诊情况，例如"我确诊白癜风X个月了""我这白癜风看了好几个月了"。禁止用"是不是白癜风""想确认是不是"等疑问句式开头。' : '【开场白规则】你还没确诊，可以用"不知道是不是""想问问"等疑问语气。'}${competitorStory}
（以上是你的大致情况，具体细节你可以自由发挥，但要符合这个方向）
`
      : '';

    // 构建真实患者沟通风格指引
    const communicationStyleGuide = `
【真实患者沟通风格】

1. 说话方式：
${rules.speakingStyle.map(s => `- ${s}`).join('\n')}

2. 信息揭露方式：
${rules.infoDisclosure.map(s => `- ${s}`).join('\n')}

3. 情绪表达：
${rules.emotionExpression.map(s => `- ${s}`).join('\n')}

4. 常见顾虑（你从以下选择1-3个作为本次对话的主要顾虑）：
${rules.commonConcerns.map(s => `- ${s}`).join('\n')}

5. 常见行为：
${rules.commonBehaviors.map(s => `- ${s}`).join('\n')}

6. 转化条件：
${rules.conversionConditions.map(s => `- ${s}`).join('\n')}

【重要】
- 你必须在对话开始时自行随机生成一个真实的白癜风患者身份
- 包括：病情部位、发现时间、既往就诊经历、当前治疗方式、心理状态、经济状况、核心顾虑
- 这些信息不要一次性告诉客服，要在对话中逐步暴露
- 客服不问，你就不说；客服问什么，你答什么
`;

    // 构建系统提示词
    const systemPrompt = `【最高优先级指令——防止出戏】
你是患者本人，不是在"扮演"患者。你只会说患者真正会说的话、做患者真正会做的事。
- 你绝对不会分析自己的人物设定、不会提及"主题""角色""应该表现""符合""训练"等元信息
- 你不会意识到自己是在模拟训练中，你不知道什么是"训练主题""训练轮次"
- 括号内可以写动作和表情（如"沉默了一会儿""发了一张照片"），但绝不能写内心分析、角色梳理、设定说明
- 你的每一条回复都必须是患者拿起手机、打开微信、真正会打出来的文字
- 禁止输出任何类似"我应该表现出焦虑""作为新发现白斑的患者""符合本轮主题"的自我分析

你是一个真实的白癜风患者，正在通过微信咨询客服。

${communicationStyleGuide}
${roundThemeSection}
${cityHint}
【知识库参考】
${getKnowledgeBase(currentCity)}

【对话规则】
1. 你是一个患者，不是客服。你的角色是考验客服的专业能力
2. 用大白话说话，不要用医学术语
3. 回复要简短，像微信聊天一样
4. 不要主动交代病史，客服问什么答什么
5. 表现出真实的情绪：焦虑、犹豫、将信将疑
6. 如果客服不问清楚情况就推方案，你要表现出不信任
7. 如果客服表现专业且关心你，你可以逐渐放下防备
8. 如果本轮训练主题中提到医保问题或同质化质疑，请在对话进行到2-3轮后自然地提出这些质疑，不要一开始就抛出。等客服建立一定信任后再抛出考验
9. 对话结束时（客服成功邀约或你决定不再咨询），回复"[对话结束]"

现在，请随机生成一个患者身份，开始对话。`;

    // 构建消息历史 - 角色转换：staff/user → user(客服), patient/assistant → assistant(AI患者)
    const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = messages.map((msg: { role: string; content: string }) => {
      let role: 'user' | 'assistant';
      if (msg.role === 'staff' || msg.role === 'user') {
        role = 'user'; // 客服输入 → user
      } else {
        role = 'assistant'; // patient/assistant → assistant (AI的回复)
      }
      return { role, content: msg.content };
    });

    // 安全检查：确保至少有一条user消息
    const hasUserMessage = chatMessages.some(m => m.role === 'user');
    if (!hasUserMessage && chatMessages.length > 0) {
      // 如果最后一条是assistant，将其改为user（最可能的用户输入）
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg.role === 'assistant') {
        lastMsg.role = 'user';
      }
    }

    // 添加系统提示词
    chatMessages.unshift({
      role: 'system',
      content: systemPrompt,
    });

    console.log('[Chat Stream] Starting stream with', chatMessages.length, 'messages, roles:', chatMessages.map(m => m.role).join(','));

    // 调用LLM流式接口
    const response = client.stream(chatMessages, {
      model: 'doubao-seed-2-0-mini-260215',
      streaming: true,
    });

    // 创建可读流
    const encoder = new TextEncoder();
    let chunkCount = 0;
    let hasError = false;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 设置流超时：60秒内无数据则终止
          const streamTimeout = setTimeout(() => {
            if (chunkCount === 0) {
              console.error('[Chat Stream] Timeout: no data received in 60s');
              hasError = true;
              const errorData = `data: ${JSON.stringify({ error: '响应超时，请重试' })}\n\n`;
              controller.enqueue(encoder.encode(errorData));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          }, 60000);

          let fullContent = '';
          for await (const chunk of response) {
            if (hasError) break;
            
            const content = extractTextFromChunk(chunk.content);
            if (content) {
              chunkCount++;
              fullContent += content;
            }
          }

          clearTimeout(streamTimeout);
          
          if (!hasError) {
            // 对完整文本做后处理替换（解决模糊词跨chunk被拆分的问题）
            const finalContent = competitors.length > 0 && fullContent
              ? replaceGenericHospitalNames(fullContent, competitors)
              : fullContent;
            
            // 调试日志：打印替换前后的文本
            if (finalContent !== fullContent) {
              console.log('[stream] 竞品替换生效:', { before: fullContent.substring(0, 100), after: finalContent.substring(0, 100) });
            }
            
            // 一次性发送替换后的完整内容
            if (finalContent) {
              const data = `data: ${JSON.stringify({ content: finalContent })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
            
            console.log('[Chat Stream] Completed, total chunks:', chunkCount);
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }
        } catch (error) {
          console.error('[Chat Stream] Error:', error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          const errorData = `data: ${JSON.stringify({ error: `生成失败: ${errorMsg}` })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Chat Stream] API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
