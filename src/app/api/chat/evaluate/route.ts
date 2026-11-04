import { NextRequest, NextResponse } from 'next/server';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { createLLM } from '@/lib/llm';
import { getKnowledgeBase, CONVERSION_STRATEGY } from '@/lib/knowledge-base';
import { getRoundTheme } from '@/lib/training-rounds';

// 评分后处理校验：当LLM的detail暴露出矛盾时自动修正分数
function validateAndFixScores(
  evaluation: Record<string, unknown>,
  messages: Array<{ role: string; content: string }>
): void {
  if (!evaluation.dimensions || !Array.isArray(evaluation.dimensions)) return;

  // 拼接客服和患者的实际消息内容，用于后处理校验
  const staffMessages = messages
    .filter((msg: { role: string }) => msg.role === 'staff' || msg.role === 'user')
    .map((msg: { content: string }) => msg.content)
    .join(' ');

  const fixRules: Array<{
    itemName: string;
    keywords: string[];
    fixScore: number;
    fixMessage: string;
    // 额外检查客服消息内容的关键词（可选）
    messageKeywords?: string[];
    // 是否检查score<fixScore（而非仅score=0）
    checkBelowScore?: boolean;
    checkPatientMessages?: boolean;
  }> = [
    {
      itemName: '发病时长',
      keywords: ['接住', '确认', '患者主动', '主动提及', '主动说'],
      fixScore: 3,
      fixMessage: '（后处理修正：患者主动提供时长信息且客服有接住，应给3分）',
    },
    {
      itemName: '患者需求',
      keywords: ['引导', '检查', '确诊', '明确'],
      fixScore: 4,
      fixMessage: '（后处理修正：客服通过引导帮患者明确了检查确诊需求，应给4分）',
      messageKeywords: ['最重要', '确诊', '检查', '明确', '当下', '核心', '需要', '想了解', '不是.*治疗', '先确定'],
    },
    {
      itemName: '痛点',
      keywords: ['共情', '回应', '理解', '担心', '害怕', '焦虑'],
      fixScore: 3,
      fixMessage: '（后处理修正：患者表达情绪且客服有共情回应，应给3分）',
      messageKeywords: ['理解', '担心', '别急', '不用急', '放心', '可以理解'],
    },
    {
      itemName: '顾虑',
      keywords: ['回应', '费用', '解答'],
      fixScore: 3,
      fixMessage: '（后处理修正：客服回应了患者顾虑，应给3分）',
    },
    {
      itemName: '谁得病',
      keywords: [],
      fixScore: 4,
      fixMessage: '（后处理修正：患者用第一人称描述自身症状，默认本人就诊，应给谁得病分）',
      messageKeywords: ['我.*白斑', '我.*白癜风', '我.*长了', '我的.*白斑', '我确诊'],
      checkPatientMessages: true,
    },
    {
      itemName: '治疗建议',
      keywords: ['检查', '确诊', '病因', '筛查', '伍德灯', 'CT', '进一步', '排查'],
      fixScore: 3,
      fixMessage: '（后处理修正：客服有建议检查/确诊，应给治疗建议分）',
    },
    {
      itemName: '原方案不足分析',
      keywords: ['不足', '局限', '误诊', '不够', '只是', '只能', '初步', '筛查', '漏诊'],
      fixScore: 3,
      fixMessage: '（后处理修正：客服有分析原检查/方案不足，应给原方案不足分析分）',
    },
    {
      itemName: '案例发送',
      keywords: ['案例', '疗效', '恢复', '相同部位', '同部位', '看这些', '类似.*患者', '情况都一样'],
      fixScore: 3,
      fixMessage: '（后处理修正：客服有发送/提及案例，应给案例发送分）',
    },
    {
      itemName: '危害告知',
      keywords: ['扩散', '费用递增', '社交影响', '风险', '拖延', '越长越多', '耽误'],
      fixScore: 3,
      fixMessage: '（后处理修正：客服有做风险/危害提醒，应给危害告知分）',
    },
    {
      itemName: '治疗史',
      keywords: [],
      fixScore: 5,
      fixMessage: '（后处理修正：客服有询问治疗史细节，应给治疗史至少5分）',
      messageKeywords: ['之前', '去过', '治了', '照光', '308', '他克莫司', '药膏', '用药', '伍德灯'],
      checkBelowScore: true,
    },
    {
      itemName: '期型',
      keywords: [],
      fixScore: 4,
      fixMessage: '（后处理修正：客服有询问白斑变化趋势，应给期型分）',
      messageKeywords: ['变大', '扩散', '新发', '扩大', '新增', '变化', '稳定', '进展'],
    },
    {
      itemName: '部位',
      keywords: [],
      fixScore: 8,
      fixMessage: '（后处理修正：客服有询问白斑数量，应给部位满分）',
      messageKeywords: ['几块', '几处', '多少', '其他部位', '别的地方', '就这一块', '只有', '还有没有'],
      checkBelowScore: true,
    },
    {
      itemName: '发病时长',
      keywords: [],
      fixScore: 3,
      fixMessage: '（后处理修正：患者已告知发病时长且客服有承接，应给发病时长分）',
      messageKeywords: ['多久', '多长时间', '什么时候', '几年', '几个月', '半年'],
      checkBelowScore: true,
    },
  ];

  for (const block of evaluation.dimensions) {
    if (!block.items || !Array.isArray(block.items)) continue;
    for (const item of block.items) {
      // 跳过notApplicable项
      if (item.notApplicable) continue;

      const rule = fixRules.find(r => r.itemName === item.name);
      if (!rule) continue;

      // 根据checkBelowScore决定检查条件
      const shouldCheck = rule.checkBelowScore
        ? (item.score ?? 0) < rule.fixScore
        : (item.score ?? 0) === 0;
      if (!shouldCheck) continue;

      const detail = String(item.detail || '');

      // 检查detail关键词
      const hasDetailKeyword = rule.keywords.length > 0 && rule.keywords.some(kw => detail.includes(kw));

      // 检查客服消息关键词
      const hasMessageKeyword = rule.messageKeywords && rule.messageKeywords.length > 0
        ? rule.messageKeywords.some(kw => {
            // 支持简单正则（如"不是.*治疗"）
            if (kw.includes('.*')) {
              try { return new RegExp(kw).test(staffMessages); } catch { return false; }
            }
            return staffMessages.includes(kw);
          })
        : false;

      // 检查患者消息关键词（用于"谁得病"等需要检测患者第一人称描述的项）
      const patientMessages = messages
        .filter((m: { role: string }) => m.role === 'patient' || m.role === 'user')
        .map((m: { content: string }) => String(m.content || ''))
        .join(' ');
      const hasPatientKeyword = rule.checkPatientMessages && rule.messageKeywords && rule.messageKeywords.length > 0
        ? rule.messageKeywords.some(kw => {
            if (kw.includes('.*')) {
              try { return new RegExp(kw).test(patientMessages); } catch { return false; }
            }
            return patientMessages.includes(kw);
          })
        : false;

      if (!hasDetailKeyword && !hasMessageKeyword && !hasPatientKeyword) continue;

      // 执行修正
      item.score = rule.fixScore;
      item.covered = true;
      item.detail = detail + rule.fixMessage;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { messages, roundNumber, city } = await request.json();
    const currentCity = (city as 'nanchang' | 'changsha' | 'shanghai' | 'ningbo' | 'wenzhou' | 'ganzhou') || null;

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const client = createLLM(customHeaders);

    // 获取轮次主题
    const roundTheme = roundNumber ? getRoundTheme(roundNumber) : null;

    // 构建对话文本
    const conversationText = messages
      .map((msg: { role: string; content: string }) => {
        if (msg.role === 'staff') {
          return `客服：${msg.content}`;
        } else {
          return `患者：${msg.content}`;
        }
      })
      .join('\n');

    const systemPrompt = `你是一个专业的医疗客服培训评估专家。请根据以下对话内容，对客服的表现进行全面评估。

## 评分基调（重要）
这是一个面向新入职客服的训练工具，评分目的是帮助新客服发现不足并改进，不是资格考试。评分时应注意：
- 语气以鼓励和指导为主，不要过于严苛
- 客服做到基本方向就应给分，不要求完美才给满分
- 对于做了但不够详细的情况，给部分分而非0分
- strengths中多发现客服做得好的地方，improvements中给出具体可操作的改进方向
- **重要提醒：客服有做到的行为就应给分，不得因不够完美给0分。只有完全没涉及的项目才给0分。客服有任何相关行为（询问、回应、引导、建议）的项目，至少给50%分数。**

## 对话内容
${conversationText}

## 患者信息
本次对话的患者是AI随机生成的真实白癜风患者，客服需要通过问诊挖掘患者的病情、病史、治疗经历、心理状态等信息。

## 知识库参考
${getKnowledgeBase(currentCity)}

## 评分框架（总分92分，两大块14项）

### 第一块：疾病信息掌握度（50分）

**很重要（每项8分，共40分）：**
1. 谁得病 - 是否确认本人就诊还是替家人咨询。注意：如果患者用第一人称描述自己的症状（如"我脚踝上长了白斑""我确诊白癜风"），可以默认是本人就诊，不需要客服额外问"是您本人吗"。患者明显是本人=4-6分；客服额外确认了=8分。
   - 必须严格执行：如果患者用第一人称描述自身症状，谁得病至少给4分，不得给0分。
   - purpose: 知道跟谁说话，能不能拍板决定看病
2. 是不是白癜风 - 是否确认了之前有没有确诊过，是白癜风还是只是白斑未查
   - purpose: 没确诊就先确诊，别瞎谈方案
3. 部位 - 是否问了白斑位置和数量。问了位置=4分；同时问了数量（如"就这一块还是有多块""其他部位还有吗"）=8分。
   - purpose: 部位决定治疗方案选择和恢复难度，也是后续匹配案例的依据
   - **【必须严格执行】部位评分标准：**
     - 8分：同时问了位置+数量（或其他部位有无白斑）
     - 4分：只问了位置
     - **必须严格执行：如果客服问了白斑数量或其他部位有无白斑，部位必须给8分。**
4. 期型 - 是否问了白斑是扩散还是稳定。注意：问"有没有变大""有没有扩散""有没有新发""最近变化大吗"就是在问期型，不需要用"进展期""稳定期"等专业术语。只要客服问了白斑变化趋势就算覆盖此项目。
   - purpose: 分期分型直接决定治疗方案，发展期和稳定期用药思路完全不同
   - **【必须严格执行】期型评分标准：**
     - 4-6分：客服问了白斑有没有变大、扩散、新增等变化趋势（不需要用专业术语）
     - 0分：完全没有涉及白斑变化趋势
     - **必须严格执行：如果客服在对话中问了白斑有没有变大、扩散、新增等变化趋势，期型必须给4-6分，不得给0分。**
5. 治疗史 - 是否了解了之前的治疗方案。客服问了医院+方案=5分；问了具体照光频率/用药时长/检查项目=8分。注意：患者主动提到频率/时长/用药名称，客服追问确认了也算。
   - purpose: 详细治疗史是后面分析"原方案为何无效"的基础，问得越细越有说服力
   - **【必须严格执行】治疗史评分标准：**
     - 8分：问了具体照光频率/用药时长/检查项目等细节
     - 5分：问了哪家医院+什么方案
     - 3分：只问"治过吗"
     - **必须严格执行：如果客服询问了患者之前在哪家医院、用了什么药或做了什么治疗，治疗史至少给5分，不得给0-3分。**

**一般重要（每项5分，共10分）：**
6. 年龄 - 是否自然聊到了年龄
   - purpose: 年龄影响代谢和恢复速度
7. 发病时长 - 是否了解得病多久。患者主动说+客服在后续对话中承接了该信息（如复述、追问变化趋势）=3-4分；客服主动问=5分。
   - purpose: 发病时长影响治疗难度评估
   - **【必须严格执行】发病时长评分标准：**
     - 5分：客服主动询问了发病时长
     - 3-4分：患者主动说了时长，客服在后续对话中有承接（如复述、追问变化趋势等）
     - 0分：对话中完全没有涉及发病时长
     - **必须严格执行：如果患者主动告知了发病时长且客服在后续对话中有提及或承接该信息，发病时长至少给3分。**

### 第二块：销售信息掌握度（42分）

**很重要（每项8分，共24分）：**
8. 患者需求 - 是否了解患者最想了解什么。三种方式都算覆盖此项目：
   - purpose: 明确患者核心诉求，后续所有专业传递和邀约都围绕患者需求展开
   - **【必须严格执行】患者需求评分标准：**
     1. 客服主动询问需求（如"您最想了解什么""您现在最关心什么"）=6-8分
     2. 患者主动表达需求，客服接住并回应=3-5分
     3. 客服帮患者明确需求（如引导患者认识到当下最重要的是确诊检查，说"你现在最重要的是做检查确诊""当下不是考虑治疗的问题而是确定是什么类型"）=4-6分
   - **必须严格执行：如果客服有帮患者明确当前最重要的事，患者需求必须给4-6分，不得给0分。**
9. 痛点 - 是否了解了这个病在生活上给患者带来的具体困扰（不是直接问，而是聊天中自然捕捉）
   - purpose: 痛点是转化的情感切入点，知道痛点才能对症下药
   - **【必须严格执行】痛点评分标准：**
     - 8分：客服主动引导发现痛点并深入聊+关联方案
     - 6分：客服主动引导发现痛点
     - 3-5分：患者主动表达了情绪/困扰，客服有共情或回应（如"理解您的心情""别担心"等）
     - 0分：患者完全没表达任何情绪/困扰，客服也没引导
     - **示例：患者说"越搜越害怕"，客服说"理解您的心情，网上信息确实容易让人紧张"→ 必须给3-5分，不能给0分**
10. 顾虑 - 是否了解了患者犹豫没来的原因（怕治不好白花钱/怕费用高/怕耽误工作/之前被骗/家人不同意等）
    - purpose: 知道顾虑才能针对性解除，否则说再多也打动不了患者

**一般重要（每项3分，共18分）：**
11. 治疗建议 - 是否根据了解到的信息给了适合患者的方案方向
    - purpose: 承接信息收集，给出差异化方案
    - **【必须严格执行】治疗建议评分标准：**
      - 是否给了适合患者的方案方向。注意：建议检查确诊/检查病因本身就是一种治疗方向。对初发患者引导检查确诊=3分（给了方向）；给了具体治疗方案方向=3分。只要对患者当下情况提供了方向就OK，不限于具体治疗方案。
      - **必须严格执行：如果客服在对话中有建议患者做检查/确诊/筛查/进一步检查，治疗建议必须给3分，不得给0分。**
12. 原方案不足分析 - 是否帮患者分析了之前方案为什么没效果（客观分析，不说"之前那个医院不行"）
    - purpose: 让患者明白之前没治好不是白癜风治不好，而是方案不对
    - **【必须严格执行】原方案不足分析评分标准：**
      - 是否分析了之前方案/检查方法的不足。注意：指出之前检查手段的局限性也算分析原方案不足（如客服说"伍德灯只能做初步筛查，容易误诊"=3分）；分析了之前治疗为什么没效果=3分。不需要全盘否定之前的医院/方案，指出检查或治疗手段的局限性即可。
      - **必须严格执行：如果客服在对话中提到了之前检查/诊断方法的局限性、不足、容易误诊等，原方案不足分析必须给3分，不得给0分。**
13. 案例发送 - 是否发送或提及了相同部位/年龄/经历的成功案例
    - purpose: 真实案例比任何说辞都有说服力
14. 危害告知 - 是否做了扩散风险/费用递增/社交影响的提醒（点到为止，不是恐吓）
    - purpose: 制造紧迫感，让患者意识到拖延的代价

### 轮次适用规则（重要）
本次对话是第${roundNumber || 1}轮训练。
- 第1轮（未确诊患者）：患者尚未确诊白癜风，以下3项标记为notApplicable=true，不纳入计分（score=0, maxScore=0）：
  - 原方案不足分析（第12项）：患者没确诊过，没有"原方案"可分析
  - 案例发送（第13项）：未确诊就发案例不合适
  - 危害告知（第14项）：未确诊就告知危害可能造成恐慌
  注意：治疗建议（第11项）在第1轮仍然适用，因为建议检查确诊本身就是一种治疗方向。
  这3项不适用时，第二块blockMaxScore = 42 - 3×3 = 33
- 第2轮及以后（已确诊患者）：所有14项都适用，第二块blockMaxScore = 42

### 评分标准
- covered=true且做得好=满分；covered=true但做得不够详细=部分分；covered=false=0分
- 不适用项：covered标记为"notApplicable"，score=0，maxScore=0，不计入blockMaxScore
- 每项的detail要写客服具体怎么做的（严格基于对话实际内容，不要编造）
- 每项的purpose是固定的，用上面框架里的内容

### workflowCheck 流程覆盖检查（与dimensions使用相同的轮次适用规则）
workflowCheck中的modules也需要遵循上述轮次适用规则：
- 第1轮时，"销售-原方案不足"、"销售-案例发送"、"销售-危害告知"这3个module应标记 notApplicable: true，covered标记为"notApplicable"。"销售-治疗建议"在第1轮仍然适用。
- 第2轮及以后，所有14个module都适用
- workflowCheck.summary中统计覆盖数时，应排除notApplicable的项，格式如："共14个环节，适用10个，覆盖7个，缺失3个"

## 转化策略知识库参考
${CONVERSION_STRATEGY}

## 医院核心优势（评分重点参考）

客服在对话中是否有效利用了以下医院核心优势进行转化，是评价其表现的关键指标。在识别亮点（strengths）和优秀回复（excellentReplies）时，优先从以下维度评价：

### 第一优先级：专家优势
- 皮肤CT检查：如南昌国丹配备皮肤CT（江西省除南昌以外其他城市都没有），可精准判断白斑类型和分期
- 华山专家坐诊：如上海华研每周有上海华山白癜风专家坐诊。很多患者挂华山专家号挂不上，或挂的不是专门看白癜风的专家，挂号费也高；但到华研可以挂上专门看白癜风的上海华山专家
- 专家全程跟踪：专家从初诊到复色全程负责，不换医生

### 第二优先级：技术优势
- 308准分子光疗：核心技术，靶向治疗白斑
- 中医中药：中西医结合方案
- ReCell技术：黑色素细胞再生技术

### 第三优先级：设备优势
- 皮肤CT：精准检测，优于传统伍德灯
- 伍德灯：专业白斑检查设备

### 第四优先级：服务优势
- 专科专治：专注白癜风
- 一站式检查：到院一次完成所有检查
- 首诊制：从第一次面诊到复色完成由同一位医生全程跟踪（小亮点，可提及但不作为重点）

## 评估要求

### 0. 分数与文字一致性（重要）
- 如果某项covered=true且detail描述了具体做法，该项分数不得为0
- 如果某项covered=false，该项分数必须为0
- 分数为0表示完全没做到

### 1. 问诊质量回顾
请生成问诊质量回顾，包含：
- 已问问题：列出客服实际询问的问题
- 漏问信息：指出客服遗漏的关键问诊方向（对照14项框架）
- 问诊逻辑评估：评价问诊的顺序和层次是否合理
- 问诊深度评估：评价问诊是否深入挖掘到关键信息

### 2. 素材使用建议
请根据对话中患者的具体顾虑，给出素材使用建议：
- 本次回顾：列出客服在对话中发送/提及的素材（如果有）
- 建议素材：按6类给出建议（建立信任/破除旧方案/建立信心/解释方案/费用环节/临门一脚）
- 关键时机：指出对话中应该发送素材的具体节点
- 漏发警示：明确指出客服错过的素材发送时机

### 3. improvements与suggestions的区别（重要）
- **improvements**（待改进项）：诊断性问题，描述客服哪里做得不足。每条不超过15字，引用具体环节名。例如：「治疗史问得不够详细」「未了解患者顾虑」「未做危害告知」
- **suggestions**（改进建议）：每条必须是客服可以直接复制发送的具体话术或完整句子，不要出现策略方法名称。每条不超过40字。例如：
  - 涉及医保问题：「患者问能否走医保时，可以回复：目前白癜风不在医保报销范围内，但我们198元检查套餐包含11项系统检查，比公立医院更全面，很多患者算下来反而更划算」
  - 涉及同质化问题：「患者说都差不多时，可以回复：我理解您的想法，不过我们每周有上海华山白癜风专家坐诊，很多患者在华山挂不上号，到我们这可以挂上专门看白癜风的华山专家」
  - 涉及共情不足：「患者表达担忧时，可以先说：我完全理解您的顾虑，很多患者一开始也有同样的担心，后来看到治疗效果后都放心了」
- improvements和suggestions内容必须完全不同

### 3.1 评价内容真实性约束（重要）
- 所有评价、改进建议和话术建议必须严格基于对话中实际发生的内容
- 不得引用或提及对话中未出现的信息
- 不得建议客服去回应患者从未提出的问题
- excellentReplies中的staffMessage必须是对话中客服实际说过的原话，不得编造或改写

## 输出格式
请严格按照以下JSON格式输出，不要输出其他内容：
{
  "totalScore": 85,
  "dimensions": [
    {
      "block": "疾病信息掌握度",
      "blockScore": 42,
      "blockMaxScore": 50,
      "items": [
        {"name": "谁得病", "priority": "很重要", "score": 8, "maxScore": 8, "covered": true, "detail": "客服问了是本人还是替家人咨询，了解到是本人就诊", "purpose": "知道跟谁说话，能不能拍板决定看病"},
        {"name": "是不是白癜风", "priority": "很重要", "score": 8, "maxScore": 8, "covered": true, "detail": "客服确认了患者已在外院确诊白癜风", "purpose": "没确诊就先确诊，别瞎谈方案"},
        {"name": "部位", "priority": "很重要", "score": 8, "maxScore": 8, "covered": true, "detail": "客服询问了白斑位置在手背", "purpose": "部位决定治疗方案选择和恢复难度，也是后续匹配案例的依据"},
        {"name": "期型", "priority": "很重要", "score": 0, "maxScore": 8, "covered": false, "detail": "客服未涉及此环节", "purpose": "分期分型直接决定治疗方案，发展期和稳定期用药思路完全不同"},
        {"name": "治疗史", "priority": "很重要", "score": 5, "maxScore": 8, "covered": true, "detail": "客服问了之前在哪治的、用的什么药，但没追问具体照光频率和时长", "purpose": "详细治疗史是后面分析原方案为何无效的基础，问得越细越有说服力"},
        {"name": "年龄", "priority": "一般重要", "score": 5, "maxScore": 5, "covered": true, "detail": "客服自然聊到了患者年龄28岁", "purpose": "年龄影响代谢和恢复速度"},
        {"name": "发病时长", "priority": "一般重要", "score": 0, "maxScore": 5, "covered": false, "detail": "客服未涉及此环节", "purpose": "发病时长影响治疗难度评估"}
      ]
    },
    {
      "block": "销售信息掌握度",
      "blockScore": 25,
      "blockMaxScore": 42,
      "items": [
        {"name": "患者需求", "priority": "很重要", "score": 5, "maxScore": 8, "covered": true, "detail": "客服通过引导帮患者明确了当前最重要的是先做检查确诊", "purpose": "明确患者核心诉求，后续所有专业传递和邀约都围绕患者需求展开"},
        {"name": "痛点", "priority": "很重要", "score": 0, "maxScore": 8, "covered": false, "detail": "客服未涉及此环节", "purpose": "痛点是转化的情感切入点，知道痛点才能对症下药"},
        {"name": "顾虑", "priority": "很重要", "score": 8, "maxScore": 8, "covered": true, "detail": "客服了解到患者担心费用高", "purpose": "知道顾虑才能针对性解除，否则说再多也打动不了患者"},
        {"name": "治疗建议", "priority": "一般重要", "score": 3, "maxScore": 3, "covered": true, "detail": "客服简单提了308光疗方案", "purpose": "承接信息收集，给出差异化方案"},
        {"name": "原方案不足分析", "priority": "一般重要", "score": 0, "maxScore": 3, "covered": false, "detail": "客服未涉及此环节", "purpose": "让患者明白之前没治好不是白癜风治不好，而是方案不对", "notApplicable": false},
        {"name": "案例发送", "priority": "一般重要", "score": 3, "maxScore": 3, "covered": true, "detail": "客服发送了同部位案例", "purpose": "真实案例比任何说辞都有说服力", "notApplicable": false},
        {"name": "危害告知", "priority": "一般重要", "score": 0, "maxScore": 3, "covered": false, "detail": "客服未涉及此环节", "purpose": "制造紧迫感，让患者意识到拖延的代价", "notApplicable": false}
      ]
    }
  ],
  "strengths": ["问诊全面", "共情到位"],
  "improvements": ["期型未询问", "未了解患者痛点"],
  "suggestions": ["询问期型：您最近白斑有没有变大或者新增的？这关系到治疗方案的选择"],
  "excellentReplies": [
    {"staffMessage": "客服的某条回复（必须是原话）", "reason": "为什么好"}
  ],
  "inquiryReview": {
    "askedQuestions": ["客服问的问题1", "客服问的问题2"],
    "missedInfo": ["漏问的信息1", "漏问的信息2"],
    "logicAssessment": "问诊逻辑评价",
    "depthAssessment": "问诊深度评价"
  },
  "materialAnalysis": {
    "usedMaterials": ["客服使用的素材"],
    "suggestedMaterials": [
      {"category": "建立信心", "content": "建议发送的内容", "timing": "发送时机", "script": "配合话术"}
    ],
    "keyTiming": [
      {"patientSaid": "患者当时说的话（从对话原文提取，≤30字）", "shouldSend": "此时应发送的素材/话术（≤30字）", "reason": "为什么此时机关键（≤30字）"}
    ],
    "missedWarnings": ["漏发警示1", "漏发警示2"]
  },
  "workflowCheck": {
    "modules": [
      {"module": "问诊-谁得病", "covered": true, "detail": "客服询问了是本人还是替家人咨询", "purpose": "知道跟谁说话，能不能拍板决定看病"},
      {"module": "问诊-是不是白癜风", "covered": true, "detail": "客服确认了患者已确诊", "purpose": "没确诊就先确诊，别瞎谈方案"},
      {"module": "问诊-部位", "covered": true, "detail": "客服询问了白斑位置", "purpose": "部位决定治疗方案选择和恢复难度，也是后续匹配案例的依据"},
      {"module": "问诊-期型", "covered": false, "detail": "客服未涉及此环节", "purpose": "分期分型直接决定治疗方案，发展期和稳定期用药思路完全不同"},
      {"module": "问诊-治疗史", "covered": true, "detail": "客服问了之前在哪治的用什么药", "purpose": "详细治疗史是后面分析原方案为何无效的基础"},
      {"module": "问诊-年龄", "covered": true, "detail": "客服自然聊到了年龄", "purpose": "年龄影响代谢和恢复速度"},
      {"module": "问诊-发病时长", "covered": false, "detail": "客服未涉及此环节", "purpose": "发病时长影响治疗难度评估"},
      {"module": "销售-患者需求", "covered": false, "detail": "客服未涉及此环节", "purpose": "明确患者核心诉求，后续所有专业传递和邀约都围绕患者需求展开"},
      {"module": "销售-痛点", "covered": false, "detail": "客服未涉及此环节", "purpose": "痛点是转化的情感切入点，知道痛点才能对症下药"},
      {"module": "销售-顾虑", "covered": true, "detail": "客服了解到患者担心费用", "purpose": "知道顾虑才能针对性解除，否则说再多也打动不了患者"},
      {"module": "销售-治疗建议", "covered": true, "detail": "客服提了308光疗方案", "purpose": "承接信息收集，给出差异化方案"},
      {"module": "销售-原方案不足", "covered": false, "detail": "客服未涉及此环节", "purpose": "让患者明白之前没治好不是白癜风治不好，而是方案不对", "notApplicable": false},
      {"module": "销售-案例发送", "covered": true, "detail": "客服发送了同部位案例", "purpose": "真实案例比任何说辞都有说服力", "notApplicable": false},
      {"module": "销售-危害告知", "covered": false, "detail": "客服未涉及此环节", "purpose": "制造紧迫感，让患者意识到拖延的代价", "notApplicable": false}
    ],
    "summary": "共14个环节，适用14个，覆盖7个，缺失7个。缺失的关键环节：问诊-期型、销售-患者需求、销售-痛点",
    "nextStep": "建议优先补充：销售-患者需求环节，因为不了解患者最关心什么，后续所有沟通都可能偏离方向"
  }
}

请开始评估：`;

    const response = await client.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请评估以上对话' },
    ], {
      model: 'doubao-seed-2-0-mini-260215',
    });

    const content = response.content || '';
    
    // 提取JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse evaluation result');
    }

    const evaluation = JSON.parse(jsonMatch[0]);

    // 后处理：评分校验与自动修正
    validateAndFixScores(evaluation, messages);

    // 后处理：根据轮次强制设置notApplicable，并重新计算blockMaxScore和blockScore
    const notApplicableNames = ['原方案不足分析', '案例发送', '危害告知'];
    const isRound1 = (roundNumber || 1) === 1;

    if (evaluation.dimensions && Array.isArray(evaluation.dimensions)) {
      for (const block of evaluation.dimensions) {
        if (block.items && Array.isArray(block.items)) {
          // 第1轮时，强制将3项标记为notApplicable（治疗建议不再标记为不适用）
          if (isRound1) {
            for (const item of block.items) {
              if (notApplicableNames.includes(item.name)) {
                item.notApplicable = true;
                item.score = 0;
                item.maxScore = 0;
                item.covered = 'notApplicable';
              }
            }
          }
          // 过滤出适用项
          const applicableItems = block.items.filter((item: { notApplicable?: boolean }) => !item.notApplicable);
          // 重新计算blockMaxScore为适用项的maxScore之和
          const calculatedBlockMax = applicableItems.reduce(
            (sum: number, item: { maxScore?: number }) => sum + (item.maxScore || 0),
            0
          );
          block.blockMaxScore = calculatedBlockMax;
          // 重新计算blockScore为适用项的score之和
          const calculatedBlockScore = applicableItems.reduce(
            (sum: number, item: { score?: number }) => sum + (item.score || 0),
            0
          );
          block.blockScore = calculatedBlockScore;
        }
      }
      const calculatedTotal = evaluation.dimensions.reduce(
        (sum: number, block: { blockScore?: number }) => sum + (block.blockScore || 0),
        0
      );
      // 计算原始满分（所有blockMaxScore之和）
      const calculatedMaxScore = evaluation.dimensions.reduce(
        (sum: number, block: { blockMaxScore?: number }) => sum + (block.blockMaxScore || 0),
        0
      );
      // 换算为100分制
      const normalizedScore = calculatedMaxScore > 0
        ? Math.round((calculatedTotal / calculatedMaxScore) * 100)
        : 0;
      evaluation.totalScore = normalizedScore;
      evaluation.maxScore = 100;
    }

    // 后处理：workflowCheck中第1轮强制设置3个module为notApplicable（治疗建议不再标记为不适用）
    if (isRound1 && evaluation.workflowCheck?.modules && Array.isArray(evaluation.workflowCheck.modules)) {
      const workflowNotApplicableModules = ['销售-治疗建议', '销售-原方案不足', '销售-案例发送', '销售-危害告知'];
      for (const mod of evaluation.workflowCheck.modules) {
        if (workflowNotApplicableModules.includes(mod.module)) {
          mod.notApplicable = true;
          mod.covered = 'notApplicable';
        }
      }
    }

    return NextResponse.json({
      totalScore: evaluation.totalScore,
      maxScore: evaluation.maxScore || 100,
      dimensions: evaluation.dimensions,
      strengths: evaluation.strengths,
      improvements: evaluation.improvements,
      suggestions: evaluation.suggestions || [],
      excellentReplies: evaluation.excellentReplies || [],
      inquiryReview: evaluation.inquiryReview || {
        askedQuestions: [],
        missedInfo: [],
        logicAssessment: '',
        depthAssessment: '',
      },
      materialAnalysis: evaluation.materialAnalysis || {
        usedMaterials: [],
        suggestedMaterials: [],
        keyTiming: [],
        missedWarnings: [],
      },
      workflowCheck: evaluation.workflowCheck || null,
      roundNumber: roundNumber || null,
      roundTitle: roundTheme?.title || null,
    });
  } catch (error) {
    console.error('Evaluation error:', error);
    return NextResponse.json({ error: '评估失败，请重试' }, { status: 500 });
  }
}
