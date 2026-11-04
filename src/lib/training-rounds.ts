// 10轮进阶训练系统配置

export interface TrainingRound {
  round: number;
  title: string;
  stage: string;
  focus: string;
  description: string;
  patientDirection: string;
  suggestedBodyPart: string;
}

// 城市本地竞品映射
export const CITY_COMPETITORS: Record<string, string[]> = {
  nanchang: ['南昌白癜风医院', '江西省皮肤病专科医院', '南昌大学第一附属医院皮肤科', '南昌中山皮肤病医院'],
  changsha: ['长沙中研白癜风医院', '长沙中科皮肤病医院', '长沙博润白癜风医院', '中南大学湘雅医院皮肤科'],
  shanghai: ['上海华山医院', '苏州瑞京白癜风医院', '杭州华研白癜风医院', '无锡开源白癜风医院', '南通复大白癜风医院'],
  ningbo: ['宁波第一医院', '宁波鄞州博润专病门诊'],
  wenzhou: [
    '杭州市第三人民医院',
    '复旦大学附属华山医院',
    '温州医科大学附属第一医院',
    '温州医科大学附属第二医院',
    '温州市中西医结合医院',
    '乐清黄七甲皮肤科',
    '温州东洋皮肤科',
    '杭州华研白癜风医院',
    '宁波博润白癜风医院',
    '宁波华仁白癜风医院',
    '台州京科白癜风医院',
  ],
  ganzhou: [
    '赣州皮肤病医院',
    '赣南医学院第一附属医院',
    '赣州市人民医院',
    '江西省皮肤病医院',
    '南康人民医院',
  ],
};

export const CITY_COMPETITOR_HINTS: Record<string, string> = {
  wenzhou: `
【温州中研真实话术提示】
- 本院：温州中研白癜风医院，温州市白斑定点检查单位，慈善总会指定定点援助单位；浙南地区只看白癜风的医院之一，温州有美国进口308准分子激光。
- 患者可能提到：杭三院、华山、温一、温二、中西医结合医院、乐清黄七甲、东洋皮肤科、杭州华研、宁波博润/华仁、台州京科。
- 杭三院/华山：先承认权威，说我们经常交流学习；再讲白癜风是慢性病，反复去杭州上海有路费食宿、挂号和时间成本，医生沟通时间短；我们能讲透病因、方案、注意事项，并持续跟进。
- 本地三甲：先肯定是好医院；再讲皮肤科疾病种类多，白癜风未必是重点，专项设备不一定全；我们专病专治，设备、医生、方案围绕白癜风。
- 黄七甲/东洋：先肯定普通皮肤病名气；再讲白癜风是免疫系统相关疾病，需要T淋巴细胞、趋化因子等专项诱因筛查和持续管理。
- 外地专科：不贬低，可说同样是专科，但外地城市生活和运营成本更高，中胚层、T淋巴细胞亚群等项目在温州中研更经济且更近便。
- 台州京科：客观说其原为皮肤科后成立白癜风科室，专项检查和光疗剂量/频率把控可能不如只做白癜风的医院；不要说“一定更好”。
- 价格可使用：中胚层380元/次；T淋巴细胞亚群检查援助后190元/次；其他费用以医院公示和医生评估为准。
- 不说“治愈率、根治、包好”，不说“会诊”，不贬低同行。`,
  ganzhou: `
【赣州中研真实话术提示】
- 本院：赣州中研白癜风医院，白癜风专科医院；赣州红十字基金会白癜风定点援助单位；价格透明，无医保。
- 医生：本院医生有20年以上经验，部分医生看白癜风30余年。
- 检查：皮肤镜、伍德灯、T淋巴细胞检测、免疫等病因检查。
- 治疗：美国进口308激光、311治疗、家用光疗仪、纳米微针黑色素导入、局部中药熏蒸、中胚层导入、黑色素种植、二氧化碳点阵激光、中药辅助；具体是否适合由医生评估。
- 核心优势：首诊负责制，一个主任从头跟到尾；医助和护理团队监控、随访；个体化方案，不千人一方。
- 患者可能提到：赣州皮肤病医院、赣南附属医院、赣州人民医院、江西省皮肤病医院、南康人民医院。
- 赣州皮肤病医院：有医保，表皮种植住院可报销，有皮肤CT/皮肤镜/伍德灯，但308非进口；我们强调美国进口308、T淋巴细胞专项检查、慢病管理和主任随访。
- 赣南附属医院：药物和308可刷医保、种植可报销，有伍德灯/皮肤镜，但方案相对简单、没有专门慢病管理；我们强调持续随访和个体化方案。
- 赣州人民医院：有医保但检查只有伍德灯；我们检查治疗更聚焦白癜风。
- 江西省皮肤病医院：三甲权威，有皮肤CT、T淋巴细胞、进口308，但距离远、慢性病反复跑时间路费成本高；我们强调本地持续管理更方便坚持。
- 南康人民医院：可刷医保余额但只有伍德灯、没有308；我们强调项目更完整。
- 红十字基金会援助是费用援助，不是报销，比例和金额以到院核实为准。
- 不说“治愈率、根治、包好”，不说“会诊”，不讲具体药品名，不贬低同行。`,
};

// 后处理：将LLM输出中的模糊医院名称替换为具体竞品名称
export function replaceGenericHospitalNames(text: string, competitors: string[]): string {
  if (!competitors || competitors.length === 0) return text;
  const primary = competitors[0];
  const secondary = competitors.length > 1 ? competitors[1] : primary;

  // 医院/看病相关关键词，用于上下文判断
  const medicalKeywords = /医院|看病|治疗|去了|看过|检查|门诊|皮肤科|专科|就诊|问诊|确诊|白斑|白癜风|光疗|手术|住院|挂号|诊所|机构|医美/;

  // 检查匹配位置前后文本是否包含医院相关语境
  const hasMedicalContext = (fullText: string, matchStart: number, matchEnd: number, windowSize = 20): boolean => {
    const contextStart = Math.max(0, matchStart - windowSize);
    const contextEnd = Math.min(fullText.length, matchEnd + windowSize);
    const context = fullText.slice(contextStart, contextEnd);
    return medicalKeywords.test(context);
  };

  // 安全模式：匹配内容本身已包含明确的医院语境，无需额外上下文检查
  const safeReplacements: [RegExp, string][] = [
    [/其他医院/g, primary],
    [/别的医院/g, primary],
    [/别家医院/g, primary],
    [/好几家医院/g, primary],
    [/几家医院/g, `${primary}和${secondary}`],
    [/其他家/g, primary],
  ];

  // 模糊模式：匹配内容本身不含医院语境，需要上下文判断
  const ambiguousReplacements: [RegExp, string][] = [
    [/跑了几家(医院)?/g, `跑过${primary}了`],
    [/看了几家(医院)?/g, `在${primary}看过`],
    [/去了几家(医院)?/g, `去过${primary}`],
    [/好几家/g, primary],
    [/别的地方/g, primary],
    [/别处/g, primary],
    [/别家/g, primary],
    [/外面(的医院|皮肤科)?/g, primary],
  ];

  let result = text;

  // 安全模式直接替换
  for (const [pattern, replacement] of safeReplacements) {
    result = result.replace(pattern, replacement);
  }

  // 模糊模式：逐个匹配，检查上下文后再决定是否替换
  for (const [pattern, replacement] of ambiguousReplacements) {
    // 重置 lastIndex（全局正则）
    pattern.lastIndex = 0;
    const regex = new RegExp(pattern.source, pattern.flags);
    const matches: { match: string; index: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(result)) !== null) {
      matches.push({ match: m[0], index: m.index });
    }
    // 从后往前替换，避免索引偏移
    for (let i = matches.length - 1; i >= 0; i--) {
      const { match, index } = matches[i];
      if (hasMedicalContext(result, index, index + match.length)) {
        result = result.slice(0, index) + replacement + result.slice(index + match.length);
      }
    }
  }

  return result;
}

export const trainingRounds: TrainingRound[] = [
  // 第一阶段：基础问诊（第1-3轮）
  {
    round: 1,
    title: '新发现白斑患者',
    stage: '基础问诊',
    focus: '基础问诊、初步判断、安抚情绪',
    description: '不确定是不是白癜风，焦虑但配合。刚发现白斑不久，未确诊，对白癜风了解少',
    patientDirection: '刚发现手背白斑不久，不确定是不是白癜风，没有去过医院确诊。对白癜风了解很少，焦虑但比较配合客服的问诊。可能会问"是不是白癜风""能不能治好"等基础问题。',
    suggestedBodyPart: '手背',
  },
  {
    round: 2,
    title: '已确诊有简单治疗史',
    stage: '基础问诊',
    focus: '方案解释、费用沟通、引导到院',
    description: '已确诊白癜风，做过一些基础治疗（如外用药），对治疗有基本了解',
    patientDirection: '已经在其他地方确诊白癜风，白斑在颈部，正在使用外用药或口服药等基础治疗。对治疗有基本了解，但不够深入。可能会问治疗方案、费用、能不能报销等问题。',
    suggestedBodyPart: '颈部',
  },
  {
    round: 3,
    title: '犹豫观望型',
    stage: '基础问诊',
    focus: '差异化优势、建立信任、破除旧认知',
    description: '多处咨询过不同医院/机构，对比心态重，觉得哪家说的都差不多',
    patientDirection: '已经咨询过多家医院或机构，白斑在嘴角周围，对比心态很重。觉得每家说的都差不多，不容易被打动。需要客服展现真正的差异化优势才能建立信任。会直接说"其他医院也这么说""你们有什么不同"。',
    suggestedBodyPart: '嘴角周围',
  },
  // 第二阶段：深度转化（第4-7轮）
  {
    round: 4,
    title: '既往治疗无效型',
    stage: '深度转化',
    focus: '分析无效原因、重建方向认知',
    description: '有较完整治疗史（可能1-2年），试过多种方案效果不好，对治疗失去信心',
    patientDirection: '有1-2年的治疗史，白斑在额头部位，试过多种方案（外用药、口服药、光疗等）但效果不好。对治疗已经失去信心，觉得"治了也白治"。需要客服专业分析既往治疗无效的原因，重建治疗方向认知。',
    suggestedBodyPart: '额头',
  },
  {
    round: 5,
    title: '经济顾虑型',
    stage: '深度转化',
    focus: '拆解费用结构、降低门槛、套餐话术',
    description: '经济条件一般或紧张，对费用非常敏感，担心治不起',
    patientDirection: '经济条件一般或紧张，白斑在手臂部位，对费用非常敏感。反复问费用、能不能报销、有没有便宜方案。在对话进行到2-3轮后，必须主动提出医保问题，如"你们能走医保吗""别家医院说他们能走医保""不走医保太贵了负担不起"。考察客服是否能用三步法（直接回答→给事实→转焦点）应对。',
    suggestedBodyPart: '手臂',
  },
  {
    round: 6,
    title: '抗拒激素型',
    stage: '深度转化',
    focus: '专业解释、替代方案、消除恐惧',
    description: '听说激素副作用大，强烈抗拒任何含激素的治疗方案',
    patientDirection: '听说激素副作用很大（长胖、依赖性等），强烈抗拒任何含激素的治疗。之前可能用过激素药出现了副作用或听别人说过。需要客服专业解释激素的使用场景和替代方案。',
    suggestedBodyPart: '头皮/发际线',
  },
  {
    round: 7,
    title: '技术质疑型',
    stage: '深度转化',
    focus: '技术知识深度、品牌化话术',
    description: '对光疗设备、治疗技术有专业层面的疑问，会问很细的技术问题',
    patientDirection: '对光疗设备、治疗技术有较深了解，会问很专业的技术问题（如308准分子和窄谱UVB的区别、中胚层介入的原理等）。在对话进行到2-3轮后，应提出同质化质疑，如"感觉你们和其他医院差不多，都是照光吃药抹药""你们有的别人也有""那我随便选一家近的就行了"。考察客服是否能用认知重构四步法（承认→信任→转换→给差异）应对。',
    suggestedBodyPart: '脚踝',
  },
  // 第三阶段：难点攻坚（第8-10轮）
  {
    round: 8,
    title: '极度焦虑型',
    stage: '难点攻坚',
    focus: '共情能力、情绪安抚、节奏把控',
    description: '情绪化严重，失眠焦虑，多疑，需要大量情绪安抚才能沟通',
    patientDirection: '情绪化非常严重，失眠、焦虑、多疑。可能白斑在面部等显眼位置，心理压力极大。需要先充分安抚情绪才能正常沟通，节奏要慢，不能急于推方案。可能会突然情绪崩溃或沉默。',
    suggestedBodyPart: '躯干（背部或胸部）',
  },
  {
    round: 9,
    title: '多疑对比型',
    stage: '难点攻坚',
    focus: '建立专业权威、真诚沟通',
    description: '质疑客服动机（是不是只为了赚钱），对比多家医院方案，不容易信任',
    patientDirection: '对客服的动机高度怀疑，觉得"你就是想让我花钱"。对比过多 家医院的方案，对营销话术非常警惕。在对话进行到2-3轮后，应同时提出同质化对比和医保问题双重质疑，如先说"感觉都差不多"再说"而且你们还不能走医保"。考察客服能否连续处理两个异议，分别用认知重构四步法和三步法应对。',
    suggestedBodyPart: '手指',
  },
  {
    round: 10,
    title: '临门一脚型',
    stage: '难点攻坚',
    focus: '促单能力、紧迫感营造、最后顾虑清除',
    description: '已经认可方案和医院，但在最后决定关头犹豫（怕疼/怕没效果/怕浪费时间）',
    patientDirection: '已经基本认可方案和医院，但在最后关头犹豫不决。在对话进行到2-3轮后，应表现出心动但最后犹豫点是医保，如"我想去但你们不走医保我还是有点犹豫""要是能走医保我就直接去了"。考察客服能否用三步法消除最后的顾虑促成到院决定。',
    suggestedBodyPart: '腿部',
  },
];

// 根据轮次获取训练主题
export function getRoundTheme(roundNumber: number): TrainingRound | null {
  return trainingRounds.find(r => r.round === roundNumber) || null;
}

// 训练进度数据结构
export interface TrainingProgress {
  round: number;
  title: string;
  score: number;
  date: string;
  passed: boolean;
  dimensionScores?: Record<string, number>;
}

const STORAGE_KEY = 'training_progress';

// 获取训练进度
export function getTrainingProgress(): TrainingProgress[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 保存训练进度
export function saveTrainingProgress(progress: TrainingProgress[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// 添加或更新某一轮的进度
export function upsertRoundProgress(entry: TrainingProgress): void {
  const progress = getTrainingProgress();
  const idx = progress.findIndex(p => p.round === entry.round);
  if (idx >= 0) {
    progress[idx] = entry;
  } else {
    progress.push(entry);
  }
  // 按轮次排序
  progress.sort((a, b) => a.round - b.round);
  saveTrainingProgress(progress);
}

// 获取当前可进行的轮次
export function getCurrentRound(): number {
  const progress = getTrainingProgress();
  if (progress.length === 0) return 1;
  // 找到最后一个通过的轮次
  const lastPassed = progress.filter(p => p.passed).sort((a, b) => b.round - a.round)[0];
  if (!lastPassed) return 1;
  return Math.min(lastPassed.round + 1, 10);
}

// 判断某一轮是否解锁（训练模块：所有轮次全部开放，无需逐轮解锁）
export function isRoundUnlocked(roundNumber: number): boolean {
  if (roundNumber < 1 || roundNumber > 10) return false;
  return true;
}

// 解锁所有训练轮次
export function setAllRoundsUnlocked(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('training_all_unlocked', 'true');
}

// 检查是否已解锁所有轮次
export function isAllRoundsUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('training_all_unlocked') === 'true';
}

// 重置训练进度
export function resetTrainingProgress(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// 是否全部完成
export function isAllRoundsCompleted(): boolean {
  const progress = getTrainingProgress();
  return progress.filter(p => p.passed).length >= 10;
}
