// 第6章：通用题目（转化策略、违禁词、同质化竞争等）
import type { QuizQuestion } from '../quiz-data';

export const chapter6CommonQuestions: QuizQuestion[] = [
  // ============ 单选题（10题）============
  {
    id: 'c6-common-s1',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '首诊制的核心优势是什么？',
    options: ['A. 价格便宜', 'B. 患者从首诊到恢复管理，尽量由同一位医生跟诊', 'C. 设备先进', 'D. 距离近'],
    answer: 'B',
    explanation: '首诊制核心优势：全程同一医生跟诊，不像公立医院每次换人，对病情全程了解。'
  },
  {
    id: 'c6-common-s2',
    type: 'single',
    difficulty: 'medium',
    category: 'F',
    question: '转化四步走的正确顺序是？',
    options: ['A. 拆解→共情→重建→低门槛', 'B. 共情→拆解→重建→低门槛体验', 'C. 重建→共情→拆解→低门槛', 'D. 低门槛→共情→拆解→重建'],
    answer: 'B',
    explanation: '转化四步走：共情→拆解→重建→低门槛体验。'
  },
  {
    id: 'c6-common-s3',
    type: 'single',
    difficulty: 'medium',
    category: 'F',
    question: '以下哪个词客服可以使用？',
    options: ['A. 根治', 'B. 治愈率95%', 'C. 帮助控制', 'D. 包好'],
    answer: 'C',
    explanation: '"帮助控制"是合规表述，"根治""治愈率""包好"都是违禁词。'
  },
  {
    id: 'c6-common-s4',
    type: 'single',
    difficulty: 'medium',
    category: 'F',
    question: '同质化竞争策略的核心是？',
    options: ['A. 争"治疗不同"', 'B. 争"方向不同"：308是施肥、中医是浇水', 'C. 贬低竞品', 'D. 价格战'],
    answer: 'B',
    explanation: '同质化竞争策略：不争"治疗不同"，争"方向不同"，308是施肥、中医是浇水，两者结合才是完整方案。'
  },
  {
    id: 'c6-common-s5',
    type: 'single',
    difficulty: 'advanced',
    category: 'F',
    question: '以下哪个是违禁词？',
    options: ['A. 帮助控制', 'B. 改善症状', 'C. 治愈率100%', 'D. 缓解病情'],
    answer: 'C',
    explanation: '"治愈率100%"是绝对化用语，属于违禁词。'
  },
  {
    id: 'c6-common-s6',
    type: 'single',
    difficulty: 'advanced',
    category: 'F',
    question: '品牌化命名的目的是？',
    options: ['A. 让名字更好听', 'B. 避免竞品直接抄袭通用表述', 'C. 提高价格', 'D. 没有目的'],
    answer: 'B',
    explanation: '品牌化命名是将通用技术词转化为独有品牌名，避免竞品直接抄袭通用表述。'
  },
  {
    id: 'c6-common-s7',
    type: 'single',
    difficulty: 'advanced',
    category: 'F',
    question: '低门槛体验的目的是？',
    options: ['A. 让患者花更多钱', 'B. 引导到院检查，不强迫直接治疗', 'C. 推销药品', 'D. 没有目的'],
    answer: 'B',
    explanation: '低门槛体验是引导患者到院检查，不强迫直接治疗。'
  },
  {
    id: 'c6-common-s8',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '转化四步走的第一步是？',
    options: ['A. 拆解', 'B. 共情', 'C. 重建', 'D. 低门槛'],
    answer: 'B',
    explanation: '转化四步走：共情→拆解→重建→低门槛体验。第一步是共情。'
  },
  {
    id: 'c6-common-s9',
    type: 'single',
    difficulty: 'medium',
    category: 'F',
    question: '"308是施肥、中医是浇水"这个比喻说明什么？',
    options: ['A. 308比中医重要', 'B. 中医比308重要', 'C. 两者结合才是完整方案', 'D. 只需要一种治疗'],
    answer: 'C',
    explanation: '308光疗和中医中药各有作用，两者结合才是完整方案。'
  },
  {
    id: 'c6-common-s10',
    type: 'single',
    difficulty: 'advanced',
    category: 'F',
    question: '以下哪种表达方式属于恐吓式表达？',
    options: ['A. 白癜风有扩散可能', 'B. 不治会扩散全身', 'C. 建议早期干预', 'D. 每个人的情况不同'],
    answer: 'B',
    explanation: '"不治会扩散全身"是恐吓式表达，属于违禁词。'
  },
  // ============ 情景判断题（7题）============
  {
    id: 'c6-common-sc1',
    type: 'scenario',
    difficulty: 'basic',
    category: 'F',
    question: '患者问："你们医院能根治吗？"以下哪个回应最合适？',
    options: [
      'A. 能，治愈率95%',
      'B. 白癜风目前无法根治，但通过规范治疗可以帮助控制病情、促进复色',
      'C. 包好',
      'D. 一定能治好'
    ],
    answer: 'B',
    explanation: '"根治""治愈率""包好"都是违禁词，应该用"帮助控制""促进复色"等合规表述。'
  },
  {
    id: 'c6-common-sc2',
    type: 'scenario',
    difficulty: 'medium',
    category: 'F',
    question: '患者说："之前在别的医院照光没效果。"以下哪个回应最合适？',
    options: [
      'A. 他们医院不行，来我们这',
      'B. 理解您的失望。治疗效果不好可能跟方向有关，我们采用308+中医的联合方案，308是施肥、中医是浇水，两者结合才是完整方案',
      'C. 那没办法了',
      'D. 吃点药就好了'
    ],
    answer: 'B',
    explanation: '转化四步走：共情→拆解→重建→低门槛体验。不争"治疗不同"，争"方向不同"。'
  },
  {
    id: 'c6-common-sc3',
    type: 'scenario',
    difficulty: 'medium',
    category: 'F',
    question: '患者说："公立医院每次换医生，你们这不一样吗？"以下哪个回应最合适？',
    options: [
      'A. 我们也一样',
      'B. 我们实行首诊制，从首诊、治疗到随访尽量由同一位医生跟诊，对您的病情全程了解',
      'C. 公立医院不行',
      'D. 不知道'
    ],
    answer: 'B',
    explanation: '首诊制是核心差异化优势，全程同一医生跟诊。'
  },
  {
    id: 'c6-common-sc4',
    type: 'scenario',
    difficulty: 'advanced',
    category: 'F',
    question: '患者说："你们治疗跟其他医院有什么不同？"以下哪个回应最合适？',
    options: [
      'A. 我们用的药不一样',
      'B. 治疗手段可能相似，但方向不同。我们采用308+中医的联合方案，308是施肥、中医是浇水，两者结合才是完整方案',
      'C. 他们医院不行',
      'D. 没有不同'
    ],
    answer: 'B',
    explanation: '同质化竞争策略：不争"治疗不同"，争"方向不同"。'
  },
  {
    id: 'c6-common-sc5',
    type: 'scenario',
    difficulty: 'advanced',
    category: 'F',
    question: '患者说："太贵了，能不能便宜点？"以下哪个回应最合适？',
    options: [
      'A. 不能便宜',
      'B. 理解您的顾虑。我们先做个全面检查，了解病情后再制定方案，不强迫直接治疗',
      'C. 那没办法了',
      'D. 你去别的医院吧'
    ],
    answer: 'B',
    explanation: '低门槛体验：引导到院检查，不强迫直接治疗。'
  },
  {
    id: 'c6-common-sc6',
    type: 'scenario',
    difficulty: 'advanced',
    category: 'F',
    question: '患者说："不治会扩散全身！"以下哪个回应最合适？',
    options: [
      'A. 是的，不治会扩散全身',
      'B. 白癜风有扩散可能，但每个人的情况不同。早期干预可以有效控制，建议来医院检查评估',
      'C. 不会扩散',
      'D. 扩散了也没办法'
    ],
    answer: 'B',
    explanation: '恐吓式表达是违禁词，应该客观说明情况，引导到院检查。'
  },
  {
    id: 'c6-common-sc7',
    type: 'scenario',
    difficulty: 'advanced',
    category: 'F',
    question: '患者问："你们医院有哪些专家？"以下哪个回应最合适？',
    options: [
      'A. 不知道',
      'B. 我们有20年以上经验的专家长期坐诊，可以为您详细介绍',
      'C. 都是大专家',
      'D. 没有专家'
    ],
    answer: 'B',
    explanation: '应该客观介绍医院专家团队，让患者了解医院的专业实力。'
  },
  // ============ 简答题（3题）============
  {
    id: 'c6-common-sh1',
    type: 'short',
    difficulty: 'basic',
    category: 'F',
    question: '请用通俗语言解释：什么是首诊制？对患者有什么好处？',
    keywords: ['首诊制', '同一位医生', '全程', '了解病情'],
    referenceAnswer: '首诊制就是从您第一次来看病、治疗到后续随访，尽量都是同一位医生跟诊。不像公立医院每次换人，您的医生对病情全程了解，治疗更连贯、更精准。',
    explanation: '客服需要让患者理解首诊制的优势，这是对比公立医院的核心差异化优势。'
  },
  {
    id: 'c6-common-sh2',
    type: 'short',
    difficulty: 'medium',
    category: 'F',
    question: '患者说之前在别的医院治疗没效果，请写出你会怎么回应（运用转化四步走，不少于80字）',
    keywords: ['共情', '理解', '拆解', '方向', '联合', '检查'],
    referenceAnswer: '我理解您的失望，花了钱没效果确实让人沮丧（共情）。之前效果不好可能跟治疗方向有关，单一疗法往往不够（拆解）。我们采用308+中医的联合方案，308是施肥、中医是浇水，两者结合才是完整方案（重建）。建议您先来做个全面检查，了解病情后再制定方案，不强迫直接治疗（低门槛）。',
    explanation: '客服需要运用转化四步走：共情→拆解→重建→低门槛体验。'
  },
  {
    id: 'c6-common-sh3',
    type: 'short',
    difficulty: 'advanced',
    category: 'F',
    question: '请列出5个客服绝对不能说的违禁词/表达方式',
    keywords: ['治愈率', '根治', '包好', '一定能治好', '贬低', '恐吓'],
    referenceAnswer: '1. 治愈率XX%（绝对化用语）；2. 根治/包好（承诺性用语）；3. 一定能治好（保证性用语）；4. 贬低其他医院（不正当竞争）；5. 不治会扩散全身/会遗传给孩子（恐吓式表达）。',
    explanation: '客服必须牢记违禁词，避免合规风险。'
  }
];
