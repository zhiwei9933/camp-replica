// 第6章：医院信息与话术转化
import type { QuizQuestion } from '../quiz-data';

export const chapter6Questions: QuizQuestion[] = [
  // ============ 单选题（15题）============
  {
    id: 'c6-s1',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '南昌国丹医院是连锁医院吗？',
    options: ['A. 是，全国连锁', 'B. 不是，是独立医院，与其他地区"国丹"无关', 'C. 是省内连锁', 'D. 是集团医院'],
    answer: 'B',
    explanation: '南昌国丹是独立医院，非连锁，与其他地区"国丹"无关，对外不得提连锁/集团。'
  },
  {
    id: 'c6-s2',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '南昌国丹医院的完整检查套餐价格是多少？',
    options: ['A. 120元', 'B. 198元', 'C. 298元', 'D. 350元'],
    answer: 'B',
    explanation: '南昌国丹完整检查套餐198元（基础120元+趋化因子检测）。'
  },
  {
    id: 'c6-s3',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '以下哪位是南昌国丹医院的常驻专家？',
    options: ['A. 王建湘', 'B. 孟凡萍', 'C. 宋云辉', 'D. 朱善华'],
    answer: 'B',
    explanation: '南昌国丹常驻专家：孟凡萍、阙光星、宋甜田。王建湘在长沙华研坐诊。'
  },
  {
    id: 'c6-s4',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '长沙华研医院是什么级别的医联体单位？',
    options: ['A. 市级二甲', 'B. 湖南省三甲', 'C. 国家级三甲', 'D. 社区医院'],
    answer: 'B',
    explanation: '长沙华研是湖南省三甲医联体单位。'
  },
  {
    id: 'c6-s5',
    type: 'single',
    difficulty: 'basic',
    category: 'F',
    question: '首诊制的核心优势是什么？',
    options: ['A. 价格便宜', 'B. 患者从首诊到恢复管理，尽量由同一位医生跟诊', 'C. 设备先进', 'D. 距离近'],
    answer: 'B',
    explanation: '首诊制核心优势：全程同一医生跟诊，不像公立医院每次换人，对病情全程了解。'
  },
  {
    id: 'c6-s6',
    type: 'single',
    difficulty: 'medium',
    category: 'F',
    question: '转化四步走的正确顺序是？',
    options: ['A. 拆解→共情→重建→低门槛', 'B. 共情→拆解→重建→低门槛体验', 'C. 重建→共情→拆解→低门槛', 'D. 低门槛→共情→拆解→重建'],
    answer: 'B',
    explanation: '转化四步走：共情→拆解→重建→低门槛体验。'
  },
  {
    id: 'c6-s7',
    type: 'single',
    difficulty: 'medium',
    category: 'F',
    question: '以下哪个词客服可以使用？',
    options: ['A. 根治', 'B. 治愈率95%', 'C. 帮助控制', 'D. 包好'],
    answer: 'C',
    explanation: '"帮助控制"是合规表述，"根治""治愈率""包好"都是违禁词。'
  },
  {
    id: 'c6-s8',
    type: 'single',
    difficulty: 'medium',
    category: 'F',
    question: '同质化竞争策略的核心是？',
    options: ['A. 争"治疗不同"', 'B. 争"方向不同"：308是施肥、中医是浇水', 'C. 贬低竞品', 'D. 价格战'],
    answer: 'B',
    explanation: '同质化竞争策略：不争"治疗不同"，争"方向不同"，308是施肥、中医是浇水，两者结合才是完整方案。'
  },
  {
    id: 'c6-s9',
    type: 'single',
    difficulty: 'medium',
    category: 'F',
    question: '南昌国丹基础检查套餐包含什么？',
    options: ['A. 仅伍德灯', 'B. 6项检查+伍德灯+CT', 'C. 仅抽血', 'D. 仅皮肤CT'],
    answer: 'B',
    explanation: '南昌国丹基础检查套餐120元，包含6项检查+伍德灯+皮肤CT。'
  },
  {
    id: 'c6-s10',
    type: 'single',
    difficulty: 'advanced',
    category: 'F',
    question: '长沙华研的检查套餐价格是多少？',
    options: ['A. 120元', 'B. 198元（11项系统检查，含趋化因子）', 'C. 298元', 'D. 350元'],
    answer: 'B',
    explanation: '长沙华研11项系统检查198元，含趋化因子检测。'
  },
  {
    id: 'c6-s11',
    type: 'single',
    difficulty: 'advanced',
    category: 'F',
    question: '王建湘医生在哪里坐诊？',
    options: ['A. 南昌国丹', 'B. 长沙华研（湖南省中医附二，每周定期坐诊）', 'C. 北京', 'D. 上海'],
    answer: 'B',
    explanation: '王建湘是湖南省中医附二专家，每周定期在长沙华研坐诊。'
  },
  {
    id: 'c6-s12',
    type: 'single',
    difficulty: 'advanced',
    category: 'F',
    question: '以下哪个是违禁词？',
    options: ['A. 帮助控制', 'B. 改善症状', 'C. 治愈率100%', 'D. 缓解病情'],
    answer: 'C',
    explanation: '"治愈率100%"是绝对化用语，属于违禁词。'
  },
  {
    id: 'c6-s13',
    type: 'single',
    difficulty: 'advanced',
    category: 'F',
    question: '品牌化命名的目的是？',
    options: ['A. 让名字更好听', 'B. 避免竞品直接抄袭通用表述', 'C. 提高价格', 'D. 没有目的'],
    answer: 'B',
    explanation: '品牌化命名是将通用技术词转化为独有品牌名，避免竞品直接抄袭通用表述。'
  },
  {
    id: 'c6-s14',
    type: 'single',
    difficulty: 'advanced',
    category: 'F',
    question: '南昌国丹和长沙华研都没有什么设备？',
    options: ['A. 伍德灯', 'B. 皮肤CT', 'C. 三氧治疗设备', 'D. 308准分子光'],
    answer: 'C',
    explanation: '两家医院都没有三氧治疗设备。'
  },
  {
    id: 'c6-s15',
    type: 'single',
    difficulty: 'advanced',
    category: 'F',
    question: '低门槛体验的目的是？',
    options: ['A. 让患者花更多钱', 'B. 引导到院检查，不强迫直接治疗', 'C. 推销药品', 'D. 没有目的'],
    answer: 'B',
    explanation: '低门槛体验是引导患者到院检查（如198元全面检查），不强迫直接治疗。'
  },
  // ============ 情景判断题（10题）============
  {
    id: 'c6-sc1',
    type: 'scenario',
    difficulty: 'basic',
    category: 'F',
    question: '患者问："你们是连锁的吧？"以下哪个回应最合适？',
    options: [
      'A. 是的，全国连锁',
      'B. 南昌国丹是独立医院，非连锁，与其他地区"国丹"无关',
      'C. 是省内连锁',
      'D. 是集团医院'
    ],
    answer: 'B',
    explanation: '南昌国丹是独立医院，非连锁，对外不得提连锁/集团。'
  },
  {
    id: 'c6-sc2',
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
    id: 'c6-sc3',
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
    id: 'c6-sc4',
    type: 'scenario',
    difficulty: 'medium',
    category: 'F',
    question: '患者问："检查要多少钱？"以下哪个回应最合适？',
    options: [
      'A. 很贵，要几千',
      'B. 我们有120元基础套餐和198元完整套餐，包含伍德灯、皮肤CT等检查，能准确判断病情',
      'C. 免费',
      'D. 不知道'
    ],
    answer: 'B',
    explanation: '应该清晰告知检查套餐价格和内容，让患者明白检查的价值。'
  },
  {
    id: 'c6-sc5',
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
    id: 'c6-sc6',
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
    id: 'c6-sc7',
    type: 'scenario',
    difficulty: 'advanced',
    category: 'F',
    question: '患者说："太贵了，能不能便宜点？"以下哪个回应最合适？',
    options: [
      'A. 不能便宜',
      'B. 理解您的顾虑。我们先做198元全面检查，了解病情后再制定方案，不强迫直接治疗',
      'C. 那没办法了',
      'D. 你去别的医院吧'
    ],
    answer: 'B',
    explanation: '低门槛体验：引导到院检查，不强迫直接治疗。'
  },
  {
    id: 'c6-sc8',
    type: 'scenario',
    difficulty: 'advanced',
    category: 'F',
    question: '患者说："你们医院没听说过，靠谱吗？"以下哪个回应最合适？',
    options: [
      'A. 我们是全国连锁',
      'B. 长沙华研是白癜风专科医院，湖南省三甲医联体单位；南昌国丹是独立医院，都有专业专家团队',
      'C. 你不信就算了',
      'D. 我们最好'
    ],
    answer: 'B',
    explanation: '应该客观介绍医院资质和优势，不夸大、不贬低竞品。'
  },
  {
    id: 'c6-sc9',
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
    id: 'c6-sc10',
    type: 'scenario',
    difficulty: 'advanced',
    category: 'F',
    question: '患者问："你们医院有哪些专家？"以下哪个回应最合适？',
    options: [
      'A. 不知道',
      'B. 南昌国丹有孟凡萍、阙光星、宋甜田；长沙华研有王建湘（湖南省中医附二）、宋云辉、朱善华、王晓红',
      'C. 都是大专家',
      'D. 没有专家'
    ],
    answer: 'B',
    explanation: '应该准确告知专家信息，让患者了解医院的专家团队。'
  },
  // ============ 简答题（5题）============
  {
    id: 'c6-sh1',
    type: 'short',
    difficulty: 'basic',
    category: 'F',
    question: '请用通俗语言解释：什么是首诊制？对患者有什么好处？',
    keywords: ['首诊制', '同一位医生', '全程', '了解病情'],
    referenceAnswer: '首诊制就是从您第一次来看病、治疗到后续随访，尽量都是同一位医生跟诊。不像公立医院每次换人，您的医生对病情全程了解，治疗更连贯、更精准。',
    explanation: '客服需要让患者理解首诊制的优势，这是对比公立医院的核心差异化优势。'
  },
  {
    id: 'c6-sh2',
    type: 'short',
    difficulty: 'medium',
    category: 'F',
    question: '患者说之前在别的医院治疗没效果，请写出你会怎么回应（运用转化四步走，不少于80字）',
    keywords: ['共情', '理解', '拆解', '方向', '联合', '检查'],
    referenceAnswer: '我理解您的失望，花了钱没效果确实让人沮丧（共情）。之前效果不好可能跟治疗方向有关，单一疗法往往不够（拆解）。我们采用308+中医的联合方案，308是施肥、中医是浇水，两者结合才是完整方案（重建）。建议您先来做个198元全面检查，了解病情后再制定方案，不强迫直接治疗（低门槛）。',
    explanation: '客服需要运用转化四步走：共情→拆解→重建→低门槛体验。'
  },
  {
    id: 'c6-sh3',
    type: 'short',
    difficulty: 'medium',
    category: 'F',
    question: '请用通俗语言解释：为什么说"308是施肥、中医是浇水"？',
    keywords: ['308', '中医', '施肥', '浇水', '联合', '完整方案'],
    referenceAnswer: '308光疗就像给皮肤施肥，直接刺激黑色素细胞恢复；中医中药就像浇水，从内部调理身体环境。两者结合才是完整方案，单靠一种往往不够。',
    explanation: '客服需要用比喻让患者理解联合治疗的重要性。'
  },
  {
    id: 'c6-sh4',
    type: 'short',
    difficulty: 'advanced',
    category: 'F',
    question: '患者问检查多少钱，请写出你的回应（不少于50字）',
    keywords: ['120', '198', '检查', '伍德灯', 'CT', '套餐'],
    referenceAnswer: '我们有两种检查套餐：基础套餐120元，包含6项常规检查+伍德灯+皮肤CT；完整套餐198元，在基础套餐上增加趋化因子检测，能更准确判断病情分期。建议做完整套餐，医生可以根据结果制定更精准的治疗方案。',
    explanation: '客服需要清晰告知检查套餐价格和内容，让患者明白检查的价值。'
  },
  {
    id: 'c6-sh5',
    type: 'short',
    difficulty: 'advanced',
    category: 'F',
    question: '请列出5个客服绝对不能说的违禁词/表达方式',
    keywords: ['治愈率', '根治', '包好', '一定能治好', '贬低', '恐吓'],
    referenceAnswer: '1. 治愈率XX%（绝对化用语）；2. 根治/包好（承诺性用语）；3. 一定能治好（保证性用语）；4. 贬低其他医院（不正当竞争）；5. 不治会扩散全身/会遗传给孩子（恐吓式表达）。',
    explanation: '客服必须牢记违禁词，避免合规风险。'
  }
];
