import { NextRequest, NextResponse } from 'next/server';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { createLLM } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const { question, referenceAnswer, keywords, userAnswer } = await request.json();
    
    if (!question || !userAnswer) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }
    
    // 构建评分prompt
    const prompt = `你是一个医疗客服培训评分员。请评估学员的简答题回答。

题目：${question}

参考答案：${referenceAnswer || '无'}

关键词/得分点：${keywords?.join('、') || '无'}

学员回答：${userAnswer}

请判断学员回答是否正确表达了关键词的核心意思。注意：
1. 意思相近的词也算正确（如"免疫系统"和"免疫力"、"自身免疫"）
2. 不要求完全一致，只要核心意思正确即可
3. 根据关键词命中情况给出评分

只返回JSON格式，不要其他内容：
{"score": 0-100的整数, "matchedKeywords": ["命中的关键词1", "命中的关键词2"], "feedback": "简短评语，说明哪些点答对了，哪些点遗漏了"}`;

    // 使用LLM进行评分
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const client = createLLM(customHeaders);
    
    const messages = [
      { role: 'user' as const, content: prompt }
    ];
    
    const response = await client.invoke(messages, {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 0.3
    });
    
    const content = response.content || '';
    
    // 解析JSON响应
    let result;
    try {
      // 尝试提取JSON部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析JSON');
      }
    } catch {
      // 解析失败，返回默认结果
      result = {
        score: 0,
        matchedKeywords: [],
        feedback: 'AI评分解析失败，请检查回答内容'
      };
    }
    
    // 确保score在0-100范围内
    const score = Math.max(0, Math.min(100, result.score || 0));
    
    return NextResponse.json({
      success: true,
      score,
      matchedKeywords: result.matchedKeywords || [],
      feedback: result.feedback || ''
    });
    
  } catch (error) {
    console.error('简答题AI评分错误:', error);
    
    // 降级：返回错误信息，前端可以使用关键词匹配降级
    return NextResponse.json({
      success: false,
      error: 'AI评分服务暂时不可用',
      score: 0,
      matchedKeywords: [],
      feedback: ''
    });
  }
}
