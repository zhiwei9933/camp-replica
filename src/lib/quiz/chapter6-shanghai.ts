// 第6章：上海华研专属题目
import type { QuizQuestion } from '../quiz-data';

export const chapter6ShanghaiQuestions: QuizQuestion[] = [
  // ============ 单选题（5题）============
  {
    id: 'c6-shanghai-s1',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '上海华研白癜风医院是什么类型的医院？',
    options: ['A. 综合医院', 'B. 白癜风专科医院', 'C. 美容医院', 'D. 社区医院'],
    answer: 'B',
    explanation: '上海华研白癜风医院是白癜风专科医院。'
  },
  {
    id: 'c6-shanghai-s2',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '上海华研的院长是谁？',
    options: ['A. 李明华', 'B. 徐英华', 'C. 张国荣', 'D. 陈志远'],
    answer: 'B',
    explanation: '上海华研院长是徐英华，看白癜风50多年，临床经验丰富。'
  },
  {
    id: 'c6-shanghai-s3',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '上海华研有什么特色学术交流资源？',
    options: ['A. 北京专家', 'B. 华山医院主任不定期学术交流', 'C. 没有专家交流', 'D. 国外专家'],
    answer: 'B',
    explanation: '上海华研有华山医院主任不定期学术交流，这是重要优势。'
  },
  {
    id: 'c6-shanghai-s4',
    type: 'single',
    difficulty: 'medium',
    category: 'F',
    question: '上海华研有什么特色中药制剂？',
    options: ['A. 芪白颗粒', 'B. 自制中药汤剂（可代煎寄送）', 'C. 没有中药', 'D. 只有中成药'],
    answer: 'B',
    explanation: '上海华研有自制中药汤剂，可代煎寄送，辨证分型开具，不进医保。'
  },
  {
    id: 'c6-shanghai-s5',
    type: 'single',
    difficulty: 'advanced',
    category: 'F',
    question: '上海华研有什么新型新型药物抑制剂药物？',
    options: ['A. 只有外用药', 'B. 有新型药物可由医生评估使用', 'C. 没有任何药物', 'D. 只有中成药'],
    answer: 'B',
    explanation: '上海华研有新型药物可由医生根据病情评估使用。'
  },
  // ============ 情景判断题（3题）============
  {
    id: 'c6-shanghai-sc1',
    type: 'scenario',
    difficulty: 'basic',
    category: 'F',
    question: '患者问："你们医院跟华山医院比怎么样？"以下哪个回应最合适？',
    options: [
      'A. 我们比华山好',
      'B. 华山医院权威度高，但排队周期长、接诊时间有限。我们是专科医院，有华山主任不定期学术交流，接诊更及时，服务更细致',
      'C. 华山不行',
      'D. 不知道'
    ],
    answer: 'B',
    explanation: '客观对比华山医院的优势和劣势，突出自身优势：专科+华山专家学术交流+服务细致。'
  },
  {
    id: 'c6-shanghai-sc2',
    type: 'scenario',
    difficulty: 'medium',
    category: 'F',
    question: '患者问："你们能进医保吗？"以下哪个回应最合适？',
    options: [
      'A. 能进医保',
      'B. 我们没有医保，但价格透明，自制中药汤剂不进医保，性价比更高',
      'C. 不知道',
      'D. 不能报销'
    ],
    answer: 'B',
    explanation: '上海华研没有医保，但价格透明，需要客观告知患者。'
  },
  {
    id: 'c6-shanghai-sc3',
    type: 'scenario',
    difficulty: 'advanced',
    category: 'F',
    question: '患者问："你们跟上海皮肤病医院比怎么样？"以下哪个回应最合适？',
    options: [
      'A. 我们比他们好',
      'B. 我们有皮肤CT、趋化因子检测，还有华山专家资源，检查更全面，而且我们是白癜风专科，只看这一种病，更专业',
      'C. 他们不行',
      'D. 不知道'
    ],
    answer: 'B',
    explanation: '上海皮肤病医院是综合皮肤病科室，不是白癜风专科，没有趋化因子检查、没有华山专家资源，这是我们的优势。'
  },
  // ============ 简答题（2题）============
  {
    id: 'c6-shanghai-sh1',
    type: 'short',
    difficulty: 'medium',
    category: 'F',
    question: '患者问你们医院有什么优势，请写出你的回应（不少于50字）',
    keywords: ['专科', '华山', '学术交流', '徐英华', '50年', '中药', '新型药物'],
    referenceAnswer: '上海华研是白癜风专科医院，有华山医院主任不定期学术交流，徐英华院长看白癜风50多年。我们有自制中药汤剂可代煎寄送，医生可根据病情评估是否需要新型药物。检查设备有三维皮肤CT、趋化因子检测等，能全面评估病情。',
    explanation: '客服需要全面介绍医院的优势，包括专家团队、特色治疗、检查设备等。'
  },
  {
    id: 'c6-shanghai-sh2',
    type: 'short',
    difficulty: 'advanced',
    category: 'F',
    question: '患者问跟华山医院比有什么优势，请写出你的回应（不少于50字）',
    keywords: ['华山', '排队', '接诊', '专科', '服务', '学术交流'],
    referenceAnswer: '华山医院权威度高，但排队周期长、接诊时间有限。我们是白癜风专科医院，有华山主任不定期学术交流，接诊更及时，服务更细致。而且我们有自制中药汤剂可代煎寄送，方便外地患者。',
    explanation: '客服需要客观对比华山医院，突出自身优势：专科+华山专家学术交流+服务细致+中药代煎。'
  }
];
