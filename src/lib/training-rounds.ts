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

// 院区本地竞品映射
export const CITY_COMPETITORS: Record<string, string[]> = {
  hefei: [
    '安徽医科大学附属医院皮肤科',
    '安徽省立医院皮肤科',
    '合肥华夏白癜风医院',
    '合肥华研白癜风医院',
  ],
  hangzhou: [
    '浙江省第三人民医院皮肤科',
    '浙江大学医学院附属第一医院皮肤科',
    '杭州丽都白癜风医院',
    '宁波博润白癜风银屑病门诊',
    '宁波华仁白癜风门诊',
    '上海华研医院',
  ],
};

export const CITY_COMPETITOR_HINTS: Record<string, string> = {
  hefei: `
【合肥天佑真实话术提示】
- 本院：合肥天佑白癜风医院（原合肥北大白癜风医院，2025年因升级为皮肤病中医院更名）；白癜风专科医院，中国医科大学合作单位；安徽省白癜风专科规模最大，8层楼6000余平方米200张病床；2014年成立至今，接诊量大复诊率高；价格透明无医保；安徽省红十字会专项援助。
- 地址：合肥市包河区马鞍山南路，地铁1号线直达。
- 检查：基础检查0元可申请援助全免（白斑6项病因筛查+伍德灯+美国三维皮肤CT）；完整套餐自费160元（基础+趋化因子）；全套（基础+T淋巴细胞或趋化因子）原价700多，援助后自费140元或160元；T淋巴细胞自费140元查CD8评估分期；趋化因子安徽省唯一，能提前判断扩散风险。
- 红线：不能只推免费检查，必须讲清全套自费140或160；不用刻意强调抽血要空腹。
- 治疗：美国Xtrac 308（25元/光斑）、311全身舱（约200元/次）、中胚层/纳晶（对患者说"复色针"，200-500元/次）、黑色素表皮移植、超脉冲CO2点阵、细胞培植种植、院内自研4种中药汤剂+熏蒸、PRP。
- 体验：进口308免费体验5个光斑，复色针中胚层体验一次。
- 专家资源：上海同济大学附属第十人民医院；北京大学航天中心医院、北京首钢医院、北京解放军总医院；中国医学科学院皮肤病医院（南京皮研所）。
- 患者可能提到：安医、合肥华夏、合肥华研、安徽省立医院。
- 安医皮肤科：三甲、可刷医保余额；皮肤CT是二维成像不清晰、周末做不了、经常坏；看所有皮肤病、接诊时间有限。应对：先承认三甲权威和医保，再讲慢性病靠持续跟进、设备故障影响复查，突出本院三维皮肤CT、趋化因子（安徽省唯一）、首诊制。
- 合肥华夏：设备接近，但无趋化因子、无T淋巴细胞亚群，价格偏高，建院时间短。应对：不贬低，聚焦检查深度。
- 合肥华研：设备接近，有皮肤CT，但无趋化因子，建院时间短。应对：同上。
- 不说"治愈率、根治、包好"，不说"会诊"，不讲具体药品名，不贬低同行。`,
  hangzhou: `
【杭州华研真实话术提示】
- 本院：杭州华研白癜风医院，独立医院，不是连锁，与其他地区"华研"无关联（不得提连锁/集团）；浙江省第一家白癜风专科医院，也是浙江省最早开设的白癜风医院，其他同类都是门诊；开设十几年，接诊量大复诊率高；价格透明无医保；浙江省云朵基金专项援助。
- 京浙沪名医堂工作室：不定期教授坐诊交流，免专家挂号费（对外说"专家坐诊/学术交流"，不说"会诊"）。
- 检查：基础套餐158元（白斑5项病因筛查+微量元素+血常规+肝肾功能+伍德灯+美国三维皮肤CT）；趋化因子浙江省第一家引进，原价400援助后120元，能提前3-5个月预警扩散风险；T淋巴细胞查免疫状态。
- 治疗：美国Xtrac 308（25-60元/光斑）、311全身舱（约200元/次）、中胚层/纳晶、黑色素表皮移植、超脉冲CO2点阵、PrimCell种植术、院内自研4种中药汤剂+熏蒸。
- 专家资源：上海华山医院、复旦大学附属华东医院、上海市第八人民医院（原复旦大学医学院）、同济大学附属第十人民医院；浙江省第三人民医院、浙江省第一人民医院；中国人民解放军火箭军总医院。
- 患者可能提到：杭三院、杭州丽都、宁波博润、宁波华仁、上海华研。
- 杭三院：三甲权威、排队久、接诊时间短、可医保统筹、皮肤CT检查费218元、皮肤科检查仅伍德灯和皮肤镜。应对：先承认权威，再讲排队和沟通时间、检查项目有限，突出首诊制、专家坐诊免挂号费、趋化因子提前3-5个月预警。
- 杭州丽都：可医保、同等检查300多元（本院可减免一半）、有杭三院退休主任徐晖（80岁，口述表达局限、知识陈旧）、有华山坐诊、2014年搬迁重组。应对：不贬低同行和医生个人，讲浙江省第一家、十几年、首诊制、检查费用更低、趋化因子。
- 宁波博润：门诊部非医院、主治疗银屑病、无皮肤CT、无趋化因子、无华山资源、主打零激素。应对：讲医院资质、只做白癜风、设备齐全、有京浙沪专家。
- 宁波华仁：门诊部非医院、无皮肤CT。应对：同上。
- 上海华研：不只看白癜风（也做植发狐臭）、设备与本院一致、有华山主任巡诊、2025年重新选址、治疗单价更贵。应对：不贬低，讲独立医院无关联、专病专治、价格透明、首诊制。
- 不说"治愈率、根治、包好"，不说"会诊"，不讲具体药品名，不贬低同行。`,
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
