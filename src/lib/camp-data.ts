// 训练营 V2：8关16小关数据
import { chapter1SubLevels } from './camp/chapter1';
import { chapter2SubLevels } from './camp/chapter2';
import { chapter3SubLevels } from './camp/chapter3';
import { chapter4SubLevels } from './camp/chapter4';
import { chapter5SubLevels } from './camp/chapter5';
import { chapter6SubLevels } from './camp/chapter6';
import { chapter7SubLevels } from './camp/chapter7';
import { finalLearnCards } from './camp/chapter8';

export type SubLevelStatus = 'available' | 'coming-soon';

export type LearnBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'quote'; text: string }
  | { type: 'highlight'; text: string; tone?: 'info' | 'warn' | 'tip' }
  | { type: 'chain'; steps: Array<string | { title: string; desc?: string }> }
  | { type: 'memo'; items: string[] };

export interface LearnCard {
  title: string;
  /** 可选：副标题/导语 */
  lead?: string;
  /** 兼容旧字段：简短正文（当 blocks 不存在时使用） */
  body?: string;
  /** 兼容旧字段 */
  bullets?: string[];
  /** 富内容块，推荐使用 */
  blocks?: LearnBlock[];
}

export type PracticeQuestion =
  | {
      id: string;
      type: 'match';
      title: string;
      instruction: string;
      // 配对题：左列项目，右列描述（展示时会打乱）
      pairs: Array<{ left: string; right: string }>;
      score: number;
    }
  | {
      id: string;
      type: 'order';
      title: string;
      instruction: string;
      steps: string[]; // 正确顺序
      score: number;
    }
  | {
      id: string;
      type: 'choice';
      title: string;
      options: string[];
      answer: number;
      explanation: string;
      score: number;
    };

export type ExamQuestion =
  | {
      id: string;
      type: 'single' | 'judge';
      question: string;
      options: string[];
      answer: number;
      explanation: string;
    }
  | {
      id: string;
      type: 'text';
      question: string;
      /**
       * 得分点：每个元素为一个同义词组（数组），命中组内任意一个关键词就算命中该得分点。
       * 例如 [['黑色素细胞','黑色素','色素细胞'], ['免疫','炎症','T细胞','自身免疫']]
       * 表示两个得分点，每个点用任一表述都算对。
       */
      keyPoints: string[][];
      /** 简答题参考答案要点（供学员"参考要点"折叠面板 + 主管复核参考） */
      referencePoints?: string[];
      /** 自动评分阈值：命中率 >= full 给满分；half <= 命中率 < full 给半分；其余 0 分。默认 0.8 / 0.5 */
      fullThreshold?: number;
      halfThreshold?: number;
      /** 预留：最短作答字数，低于此数直接 0 分。默认 8 */
      minChars?: number;
    }
  | {
      // 兼容历史数据：老的口述题字段仍保留在类型里，确保旧数据不报错；
      // 新考核流程不再使用此类型。
      id: string;
      type: 'oral';
      question: string;
      referencePoints: string[];
      minDuration?: number;
      maxDuration?: number;
    };

// 简答题自动评分结果（每题）
export interface TextQuestionScore {
  questionId: string;
  answer: string;
  hitCount: number; // 命中的得分点数
  totalPoints: number; // 得分点总数
  ratio: number; // hitCount / totalPoints
  awarded: number; // 0 / 0.5 / 1（相对 perQ 的系数）
  matchedKeywords: string[]; // 命中的关键词（便于后台复核）
  /** 本题满分（新数据写入；旧数据缺省时由后台按小关均分分） */
  maxScore?: number;
  /** 服务端 LLM 语义兜底判分系数（仅当关键词 ratio<0.5 触发 LLM 时写入；awarded 已取关键词与 LLM 较高者） */
  llmAwarded?: number;
  /** LLM 判定命中的要点（与关键词命中合并） */
  llmMatchedPoints?: string[];
  /** LLM 一句话判分理由 */
  llmReason?: string;
}

// 客观题（单选/判断）逐题作答结果（V2.2 起新数据写入，供后台薄弱作答展示）
export interface ObjectiveQuestionScore {
  questionId: string;
  type: 'single' | 'judge';
  chosen: number; // 学员所选选项下标（-1 表示未作答）
  correct: number; // 正确答案下标
  isCorrect: boolean;
  score: number; // 本题得分
  maxScore: number; // 本题满分
}

// 考核成绩明细：用于后台展示与主管手动调整简答题分数后重算小关 examScore
export interface ExamBreakdown {
  kind: 'standard' | 'final';
  objectiveCorrect: number; // 答对的客观题数（含 single + judge）
  objectiveTotal: number; // 客观题总数
  objectivePerPoint: number; // 每道客观题分值
  /** 客观题逐题明细（V2.2 起写入；旧数据无此字段，后台仅展示其简答题薄弱项） */
  objectiveScores?: ObjectiveQuestionScore[];
  textQuestionIds: string[]; // 本次作答中包含的简答题 questionId
  textPerPoint: number; // 每道简答题满分值
  textScores: TextQuestionScore[]; // 各简答题的自动评分明细
  examMax: number; // 考核满分（standard 50；final 99）
  // 以下字段保留用于兼容旧数据/旧录音重算流程
  /** @deprecated 使用 textQuestionIds */
  oralQuestionIds?: string[];
  /** @deprecated 使用 textPerPoint */
  oralPerPoint?: number;
  /** @deprecated final 中情景题合并为 textQuestionIds */
  scenarioQuestionIds?: string[];
  /** @deprecated */
  scenarioPerPoint?: number;
}

export interface SubLevel {
  id: string; // '1-1'
  index: number; // 1
  title: string;
  desc: string;
  duration: number; // 分钟
  status: SubLevelStatus;
  learnCards?: LearnCard[];
  practice?: PracticeQuestion[];
  exam?: ExamQuestion[];
}

export interface Level {
  id: number;
  name: string;
  desc: string;
  icon: string;
  colorClass: string; // tailwind 背景类
  subLevels: SubLevel[];
  boss?: boolean;
}

export const LEVELS: Level[] = [
  {
    id: 1,
    name: '认识白癜风',
    desc: '细胞层面机制、中医视角、病因与诱因、三大误区',
    icon: '🔬',
    colorClass: 'bg-[#EBF0FF]',
    subLevels: chapter1SubLevels as SubLevel[],
  },
  {
    id: 2,
    name: '看懂病情',
    desc: '进展期vs稳定期、颜色判断、同形反应、6种方案',
    icon: '👁️',
    colorClass: 'bg-[#E6F7FF]',
    subLevels: chapter2SubLevels as SubLevel[],
  },
  {
    id: 3,
    name: '我们的武器库',
    desc: '药物六兄弟、光疗三件套、物理治疗与中医调理、病因筛查',
    icon: '🧰',
    colorClass: 'bg-[#FFF6E0]',
    subLevels: chapter3SubLevels as SubLevel[],
  },
  {
    id: 4,
    name: '明白怎么治',
    desc: '种地四步铁律、样板间策略、平台期、安全概念、特殊人群',
    icon: '🌱',
    colorClass: 'bg-[#E6F9F1]',
    subLevels: chapter4SubLevels as SubLevel[],
  },
  {
    id: 5,
    name: '挖出病根',
    desc: '5个问诊方向、反复发作原因、前兆线索、病因筛查',
    icon: '🔍',
    colorClass: 'bg-[#F3EFFF]',
    subLevels: chapter5SubLevels as SubLevel[],
  },
  {
    id: 6,
    name: '讲到心坎里',
    desc: '费用/疗效/信任应对、距离犹豫处理、沟通红线',
    icon: '💬',
    colorClass: 'bg-[#FFEAF4]',
    subLevels: chapter6SubLevels as SubLevel[],
  },
  {
    id: 7,
    name: '我们的底气',
    desc: '首诊负责制、讲什么看时机、完整对话节奏',
    icon: '🏛️',
    colorClass: 'bg-[#E8F4FF]',
    subLevels: chapter7SubLevels as SubLevel[],
  },
  {
    id: 8,
    name: '结业考核',
    desc: '综合口试 + 情景模拟 + 判断，通关即可上线接咨询',
    icon: '🏆',
    colorClass: 'bg-[#FFF0E8]',
    boss: true,
    subLevels: [
      {
        id: '8-1',
        index: 1,
        title: '终极考核',
        desc: '口试 15 选 7 · 情景 10 选 5 · 判断 5 题全做，满分 99',
        duration: 30,
        status: 'available',
        learnCards: finalLearnCards,
      },
    ],
  },
];

export function getLevel(id: number): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function getSubLevel(levelId: number, subId: string): SubLevel | undefined {
  return getLevel(levelId)?.subLevels.find((s) => s.id === subId);
}

export function flattenSubLevels(): Array<{ level: Level; sub: SubLevel; globalIndex: number }> {
  const result: Array<{ level: Level; sub: SubLevel; globalIndex: number }> = [];
  let idx = 0;
  for (const level of LEVELS) {
    for (const sub of level.subLevels) {
      result.push({ level, sub, globalIndex: idx });
      idx++;
    }
  }
  return result;
}

// 段位体系
export interface Rank {
  key: string;
  name: string;
  icon: string;
  minScore: number;
  color: string;
}

export const RANKS: Rank[] = [
  { key: 'rookie', name: '初出茅庐', icon: '🌱', minScore: 0, color: '#979DB2' },
  { key: 'beginner', name: '略懂皮毛', icon: '🌿', minScore: 150, color: '#00B578' },
  { key: 'skilled', name: '渐入佳境', icon: '🌳', minScore: 300, color: '#4F6BED' },
  { key: 'expert', name: '得心应手', icon: '🔥', minScore: 500, color: '#FF8A3D' },
  { key: 'master', name: '炉火纯青', icon: '🏆', minScore: 99999, color: '#FFB800' },
];

export function getRank(score: number): Rank {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (score >= r.minScore) current = r;
  }
  return current;
}

export function getNextRank(score: number): Rank | null {
  for (const r of RANKS) {
    if (score < r.minScore) return r;
  }
  return null;
}

export function getStars(totalScore: number): number {
  if (totalScore >= 90) return 3;
  if (totalScore >= 80) return 2;
  if (totalScore >= 70) return 1;
  return 0;
}

export const PASS_SCORE = 70;
