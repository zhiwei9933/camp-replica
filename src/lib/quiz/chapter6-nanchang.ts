// 第6章：南昌国丹专属题目
import type { QuizQuestion } from '../quiz-data';

export const chapter6NanchangQuestions: QuizQuestion[] = [
  // ============ 单选题（5题）============
  {
    id: 'c6-nanchang-s1',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '南昌国丹白癜风医院是什么类型的医院？',
    options: ['A. 综合医院', 'B. 白癜风专科医院', 'C. 美容医院', 'D. 社区医院'],
    answer: 'B',
    explanation: '南昌国丹白癜风医院是白癜风专科医院。'
  },
  {
    id: 'c6-nanchang-s2',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '南昌国丹的基础检查套餐价格是多少？',
    options: ['A. 120元', 'B. 198元', 'C. 298元', 'D. 350元'],
    answer: 'A',
    explanation: '南昌国丹基础检查伍德灯+皮肤CT+专项病因筛查总共120元。'
  },
  {
    id: 'c6-nanchang-s3',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '南昌国丹有什么特色治疗技术？',
    options: ['A. 三氧治疗', 'B. 中胚层技术', 'C. 没有特色技术', 'D. 有光疗'],
    answer: 'B',
    explanation: '南昌国丹有中胚层技术，申请了专利技术，很多患者反馈治疗效果好，这是特色治疗技术之一。'
  },
  {
    id: 'c6-nanchang-s4',
    type: 'single',
    difficulty: 'medium',
    category: 'F',
    question: '以下哪项是南昌国丹在江西省独有的检查项？',
    options: [
      'A. 美国进口三维皮肤CT',
      'B. 趋化因子',
      'C. T淋巴细胞亚群检测',
      'D. 免疫五项'
    ],
    answer: 'A',
    explanation: '南昌国丹拥有美国进口三维皮肤CT，在江西省除南昌以外的城市医院基本没有。另外趋化因子检查也是江西省独家的，可以判断患者白斑在未来3-5个月会不会扩散，趋化因子相当于导航，是指导T淋巴细胞精准找到黑色素细胞的关键信号，查出问题，精准切断导航可以更快速的推进疗效。'
  },
  {
    id: 'c6-nanchang-s5',
    type: 'single',
    difficulty: 'advanced',
    category: 'F',
    question: '南昌国丹医院的地址具体地址是哪里？距离南昌西站车程多久？距离南昌站车程多久？',
    options: [
      'A. 洪都南大道207号，距离西站20分钟，距离南昌站10分钟',
      'B. 洪都北大道207号，距离西站10分钟，距离南昌站20分钟',
      'C. 井冈山大道217号，距离西站20分钟，距离南昌站10分钟',
      'D. 井冈山大道217号，距离西站10分钟，距离南昌站10分钟'
    ],
    answer: 'A',
    explanation: '南昌国丹医院地址洪都南大道207号，鼎盛大酒店旁边/博大耳鼻喉旁边；距离火车站10分钟车程，距离西站20分钟左右车程（建议患者手机打车，因为出现过出租车司机把患者故意拉去其他医院的情况）。'
  },
  // ============ 情景判断题（3题）============
  {
    id: 'c6-nanchang-sc1',
    type: 'scenario',
    difficulty: 'basic',
    category: 'F',
    question: '患者问："你们是三甲医院吗？"以下哪个回应最合适？',
    options: [
      'A. 我们是三甲医院。',
      'B. 我们是白癜风专科医院，虽然不是三甲，但有三甲医院的专家资源，而且专病专治更专业。',
      'C. 不是。',
      'D. 不知道。'
    ],
    answer: 'B',
    explanation: '南昌国丹不是三甲医院，但有专家资源和专科优势。要诚实告知，同时讲差异化优势。'
  },
  {
    id: 'c6-nanchang-sc2',
    type: 'scenario',
    difficulty: 'medium',
    category: 'F',
    question: '患者问："你们检查包含什么项目？"以下哪个回应最合适？',
    options: [
      'A. 就抽个血。',
      'B. 我们有12项系统检查，包含伍德灯、皮肤CT、趋化因子检测等，能全面评估病情。',
      'C. 检查很简单。',
      'D. 不知道。'
    ],
    answer: 'B',
    explanation: '应该详细介绍检查项目，让患者明白检查的价值。'
  },
  {
    id: 'c6-nanchang-sc3',
    type: 'scenario',
    difficulty: 'advanced',
    category: 'F',
    question: '患者问："检查多少钱？"以下哪个回应最合适？',
    options: [
      'A. 298元，包含12项系统检查，伍德灯、皮肤CT、趋化因子检测等全面检查，能帮医生精准判断病情。',
      'B. 很贵。',
      'C. 很便宜。',
      'D. 不知道。'
    ],
    answer: 'A',
    explanation: '清晰告知检查套餐价格和内容，让患者明白检查的价值。'
  },
  // ============ 简答题（2题）============
  {
    id: 'c6-nanchang-sh1',
    type: 'short',
    difficulty: 'medium',
    category: 'F',
    question: '请介绍南昌国丹的检查套餐（不少于30字）。',
    keywords: ['12项', '298元', '伍德灯', 'CT', '趋化因子'],
    referenceAnswer: '南昌国丹有12项系统检查套餐，298元，包含伍德灯、皮肤CT、趋化因子检测等全面检查，能精准判断病情分期分型，帮助医生制定针对性方案。',
    explanation: '客服需要清晰告知检查套餐价格和内容。'
  },
  {
    id: 'c6-nanchang-sh2',
    type: 'short',
    difficulty: 'advanced',
    category: 'F',
    question: '患者问南昌国丹跟公立三甲比有什么优势，请写出你的回应（不少于30字）。',
    keywords: ['专科', '专病专治', '全程跟踪', '皮肤CT', 'ReCell'],
    referenceAnswer: '公立三甲综合实力强，但我们是白癜风专科医院，专病专治只看这一种病，医生经验更丰富。我们有皮肤CT、ReCell等特色设备和技术的检查和治疗。而且有首诊制，一位医生全程负责，不用每次换医生。',
    explanation: '客服需要客观对比公立三甲，突出专科医院的差异化优势。'
  }
];
