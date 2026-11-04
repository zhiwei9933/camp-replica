// 第6章：长沙华研专属题目
import type { QuizQuestion } from '../quiz-data';

export const chapter6ChangshaQuestions: QuizQuestion[] = [
  // ============ 单选题（5题）============
  {
    id: 'c6-changsha-s1',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '长沙华研白癜风医院是什么类型的医院？',
    options: ['A. 综合医院', 'B. 白癜风专科医院', 'C. 美容医院', 'D. 社区医院'],
    answer: 'B',
    explanation: '长沙华研白癜风医院是白癜风专科医院。'
  },
  {
    id: 'c6-changsha-s2',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '长沙华研是什么级别的合作单位？',
    options: ['A. 二甲医联体', 'B. 湖南省三甲医联体单位', 'C. 没有合作', 'D. 社区合作'],
    answer: 'B',
    explanation: '长沙华研是湖南省三甲医联体单位。'
  },
  {
    id: 'c6-changsha-s3',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '长沙华研的检查套餐价格是多少？',
    options: ['A. 120元', 'B. 198元', 'C. 298元', 'D. 350元'],
    answer: 'B',
    explanation: '长沙华研11项系统检查198元，含趋化因子检测。'
  },
  {
    id: 'c6-changsha-s4',
    type: 'single',
    difficulty: 'medium',
    category: 'F',
    question: '以下哪位是长沙华研的常驻专家？',
    options: ['A. 李明华', 'B. 王建湘', 'C. 张国荣', 'D. 陈志远'],
    answer: 'B',
    explanation: '长沙华研常驻专家：王建湘（湖南省中医附二，每周定期坐诊）、宋云辉、朱善华、王晓红。'
  },
  {
    id: 'c6-changsha-s5',
    type: 'single',
    difficulty: 'advanced',
    category: 'F',
    question: '长沙华研没有什么设备？',
    options: ['A. 伍德灯', 'B. 皮肤CT', 'C. 三氧治疗设备', 'D. 308准分子光'],
    answer: 'C',
    explanation: '长沙华研没有三氧治疗设备。'
  },
  // ============ 情景判断题（3题）============
  {
    id: 'c6-changsha-sc1',
    type: 'scenario',
    difficulty: 'basic',
    category: 'F',
    question: '患者问："你们是三甲医院吗？"以下哪个回应最合适？',
    options: [
      'A. 我们是三甲医院',
      'B. 我们是湖南省三甲医联体单位，与三甲医院有深度合作',
      'C. 不是',
      'D. 不知道'
    ],
    answer: 'B',
    explanation: '长沙华研是湖南省三甲医联体单位，不是三甲医院，但有深度合作。'
  },
  {
    id: 'c6-changsha-sc2',
    type: 'scenario',
    difficulty: 'medium',
    category: 'F',
    question: '患者问："你们有哪些专家？"以下哪个回应最合适？',
    options: [
      'A. 不知道',
      'B. 我们有王建湘（湖南省中医附二，每周定期坐诊）、宋云辉、朱善华、王晓红等专家',
      'C. 都是大专家',
      'D. 没有专家'
    ],
    answer: 'B',
    explanation: '应该准确告知专家信息，特别是王建湘教授的背景。'
  },
  {
    id: 'c6-changsha-sc3',
    type: 'scenario',
    difficulty: 'advanced',
    category: 'F',
    question: '患者问："检查包含什么项目？"以下哪个回应最合适？',
    options: [
      'A. 就抽个血',
      'B. 我们有11项系统检查，包含伍德灯、皮肤CT、趋化因子检测等，能全面评估病情',
      'C. 检查很简单',
      'D. 不知道'
    ],
    answer: 'B',
    explanation: '应该详细介绍检查项目，让患者明白检查的价值。'
  },
  // ============ 简答题（2题）============
  {
    id: 'c6-changsha-sh1',
    type: 'short',
    difficulty: 'medium',
    category: 'F',
    question: '患者问检查多少钱，请写出你的回应（不少于50字）',
    keywords: ['198', '11项', '检查', '伍德灯', 'CT', '趋化因子'],
    referenceAnswer: '我们有11项系统检查套餐，198元，包含伍德灯、皮肤CT、趋化因子检测等全面检查。趋化因子检测能准确判断病情分期，帮助医生制定更精准的治疗方案。',
    explanation: '客服需要清晰告知检查套餐价格和内容，让患者明白检查的价值。'
  },
  {
    id: 'c6-changsha-sh2',
    type: 'short',
    difficulty: 'advanced',
    category: 'F',
    question: '请介绍长沙华研的专家团队（不少于30字）',
    keywords: ['王建湘', '宋云辉', '朱善华', '王晓红', '中医附二'],
    referenceAnswer: '长沙华研有王建湘教授（湖南省中医附二，每周定期坐诊）、宋云辉、朱善华、王晓红等专家，临床经验丰富。',
    explanation: '客服需要准确介绍医院的专家团队，让患者了解医院的专业实力。'
  }
];
