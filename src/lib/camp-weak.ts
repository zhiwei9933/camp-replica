// 薄弱作答派生存储：按人分 key，camp_weak:{city}:{staffName}
//
// 设计要点：
// - camp_results 是唯一成绩库；camp_weak:* 只是「薄弱提醒」的派生存储，可随时从成绩明细重建。
// - 每次考核提交（成功写入成绩）时，同步把本次未满分题目追加进该人的 camp_weak key。
// - 条目当前仅做展示（主管端暂无删除操作）；如需物理移除，按 id 从该人数组中重写即可。
//   「重考又错重新出现」天然满足：重考是新的提交，submittedAt 不同 → 追加新条目。
// - 条目唯一 id = staffName|city|subId|questionId|submittedAt（绑定某次提交+某题）。
// - 全部 key 永久保留（不设 TTL）。
import { upstashCommand } from './upstash';
import { flattenSubLevels, type ExamBreakdown } from './camp-data';
import {
  oralQuestions as finalOral,
  scenarioQuestions as finalScenario,
  judgeQuestions as finalJudge,
} from './camp/chapter8';

export const CAMP_WEAK_PREFIX = 'camp_weak:';

/** 薄弱作答条目（展开/收起均可由服务端数据直接渲染） */
export interface WeakEntry {
  /** 唯一 id：staffName|city|subId|questionId|submittedAt */
  id: string;
  staffName: string;
  city: string;
  subId: string;
  /** 展示用关卡名，如「第 1 章 · 初识白癜风」/「第 8 章 · 结业考核」 */
  subTitle: string;
  questionId: string;
  qType: 'single' | 'judge' | 'text';
  questionText: string;
  submittedAt: string;
  // 简答题字段
  /** 学员回答原文（完整，不截断） */
  answer?: string;
  referencePoints?: string[];
  keyPointGroups?: string[][];
  /** 得分点命中率 0~1（简答题） */
  ratio?: number;
  hitCount?: number;
  totalPoints?: number;
  /** 本题实际得分 / 满分（简答与客观通用） */
  score?: number;
  maxScore?: number;
  // 客观题字段
  options?: string[];
  /** 学员所选选项下标（-1 未作答） */
  chosen?: number;
  /** 正确答案下标 */
  correct?: number;
  /** 答案解析（客观题） */
  explanation?: string;
  /** 服务端 LLM 语义评阅理由（新评分逻辑提交的简答题） */
  llmReason?: string;
}

interface QuestionMeta {
  question: string;
  type: 'single' | 'judge' | 'text';
  subTitle: string;
  options?: string[];
  answer?: number;
  explanation?: string;
  referencePoints?: string[];
  keyPoints?: string[][];
}

let cachedQMap: Map<string, QuestionMeta> | null = null;

/** 题库全量题目元信息（标准关 + 结业考），服务端按 questionId 查题干/选项/答案/得分点 */
export function getQuestionMetaMap(): Map<string, QuestionMeta> {
  if (cachedQMap) return cachedQMap;
  const m = new Map<string, QuestionMeta>();
  for (const { level, sub } of flattenSubLevels()) {
    const subTitle = `第 ${level.id} 章 · ${sub.title || sub.desc || ''}`.replace(/\s+/g, '').trim();
    for (const q of sub.exam || []) {
      if (q.type === 'text') {
        m.set(q.id, {
          question: q.question,
          type: 'text',
          subTitle,
          referencePoints: q.referencePoints || [],
          keyPoints: q.keyPoints || [],
        });
      } else if (q.type === 'single' || q.type === 'judge') {
        m.set(q.id, {
          question: q.question,
          type: q.type,
          subTitle,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
        });
      }
    }
  }
  for (const q of [...finalOral, ...finalScenario] as Array<{
    id: string;
    question: string;
    referencePoints?: string[];
    keyPoints?: string[][];
  }>) {
    if (!m.has(q.id)) {
      m.set(q.id, {
        question: q.question,
        type: 'text',
        subTitle: '第 8 章 · 结业考核',
        referencePoints: q.referencePoints || [],
        keyPoints: q.keyPoints || [],
      });
    }
  }
  for (const q of finalJudge) {
    if (!m.has(q.id)) {
      m.set(q.id, {
        question: q.question,
        type: 'judge',
        subTitle: '第 8 章 · 结业考核',
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
      });
    }
  }
  cachedQMap = m;
  return m;
}

export function weakEntryId(opts: {
  staffName: string;
  city: string;
  subId: string;
  questionId: string;
  submittedAt: string;
}): string {
  return `${opts.staffName}|${opts.city}|${opts.subId}|${opts.questionId}|${opts.submittedAt}`;
}

function weakKey(city: string, staffName: string): string {
  return `${CAMP_WEAK_PREFIX}${city}:${staffName}`;
}

/**
 * 从一次成绩提交的 examBreakdown 中抽取「未满分题目」薄弱条目。
 * - 客观题：isCorrect === false（答错/未答）
 * - 简答题：awarded < 1（未满分），且有作答原文
 */
export function buildWeakEntriesFromBreakdown(input: {
  staffName: string;
  city: string;
  subId: string;
  submittedAt: string;
  examBreakdown: ExamBreakdown | null | undefined;
}): WeakEntry[] {
  const { staffName, city, subId, submittedAt, examBreakdown } = input;
  if (!examBreakdown) return [];
  const bd = examBreakdown as ExamBreakdown & {
    textAnswers?: Record<string, string>;
  };
  const qmap = getQuestionMetaMap();
  const entries: WeakEntry[] = [];
  const finalTitle = '第 8 章 · 结业考核';

  const base = {
    staffName,
    city,
    subId,
    submittedAt,
  };

  // 简答题：awarded < 1
  const textScores = Array.isArray(bd.textScores) ? bd.textScores : [];
  for (const ts of textScores) {
    if (!ts || !ts.questionId) continue;
    const awarded = typeof ts.awarded === 'number' ? ts.awarded : 0;
    if (awarded >= 1) continue;
    const answer = ((bd.textAnswers?.[ts.questionId] ?? ts.answer ?? '') || '').trim();
    if (!answer) continue;
    const meta = qmap.get(ts.questionId);
    const ratio = typeof ts.ratio === 'number' ? ts.ratio : 0;
    const maxScore =
      typeof ts.maxScore === 'number'
        ? ts.maxScore
        : typeof bd.textPerPoint === 'number'
          ? bd.textPerPoint
          : 0;
    entries.push({
      ...base,
      id: weakEntryId({ ...base, questionId: ts.questionId }),
      subTitle: meta?.subTitle || (subId === '8-1' ? finalTitle : `小关 ${subId}`),
      questionId: ts.questionId,
      qType: 'text',
      questionText: meta?.question || ts.questionId,
      answer,
      referencePoints: meta?.referencePoints || [],
      keyPointGroups: meta?.keyPoints || [],
      ratio,
      hitCount: typeof ts.hitCount === 'number' ? ts.hitCount : 0,
      totalPoints: typeof ts.totalPoints === 'number' ? ts.totalPoints : 0,
      score: Math.round(maxScore * awarded * 10) / 10,
      maxScore,
      llmReason: typeof ts.llmReason === 'string' ? ts.llmReason : undefined,
    });
  }

  // 客观题：isCorrect === false
  const objScores = Array.isArray(bd.objectiveScores) ? bd.objectiveScores : [];
  for (const os of objScores) {
    if (!os || !os.questionId) continue;
    if (os.isCorrect !== false) continue;
    const meta = qmap.get(os.questionId);
    const maxScore =
      typeof os.maxScore === 'number'
        ? os.maxScore
        : typeof bd.objectivePerPoint === 'number'
          ? bd.objectivePerPoint
          : 0;
    entries.push({
      ...base,
      id: weakEntryId({ ...base, questionId: os.questionId }),
      subTitle: meta?.subTitle || (subId === '8-1' ? finalTitle : `小关 ${subId}`),
      questionId: os.questionId,
      qType: os.type === 'single' ? 'single' : 'judge',
      questionText: meta?.question || os.questionId,
      options: meta?.options,
      chosen: typeof os.chosen === 'number' ? os.chosen : -1,
      correct: typeof os.correct === 'number' ? os.correct : meta?.answer ?? -1,
      explanation: meta?.explanation,
      score: 0,
      maxScore,
    });
  }

  return entries;
}

/** 读取某个人的薄弱条目（损坏/不存在返回空数组） */
export async function readWeakEntries(city: string, staffName: string): Promise<WeakEntry[]> {
  const raw = (await upstashCommand(['GET', weakKey(city, staffName)])) as string | null;
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr.filter((e) => e && typeof e.id === 'string') as WeakEntry[]) : [];
  } catch {
    return [];
  }
}

/** 追加某次提交的薄弱条目到该人的 camp_weak key（按 id 去重），永久保留。返回写后总条目数 */
export async function appendWeakEntries(city: string, staffName: string, entries: WeakEntry[]): Promise<number> {
  if (entries.length === 0) {
    const cur = await readWeakEntries(city, staffName);
    return cur.length;
  }
  const key = weakKey(city, staffName);
  // 纯 GET/SET 读改写（与 camp_progress 的 SET 路径一致，避免 Lua cjson 对中文/特殊字符的转义差异）
  const existing = await readWeakEntries(city, staffName);
  const seen = new Set(existing.map((e) => e.id));
  let added = 0;
  for (const e of entries) {
    if (!seen.has(e.id)) {
      existing.push(e);
      seen.add(e.id);
      added += 1;
    }
  }
  if (added > 0) {
    await upstashCommand(['SET', key, JSON.stringify(existing)]);
  }
  console.log(
    `[camp-weak] append city=${city} staff=${staffName} +${added}/${entries.length} total=${existing.length}`,
  );
  return existing.length;
}

/** SCAN 列举所有 camp_weak:* 的 key（原始字符串），可选按城市过滤 */
export async function listWeakKeys(opts?: { city?: string }): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  for (;;) {
    const res = (await upstashCommand([
      'SCAN',
      String(cursor),
      'MATCH',
      `${CAMP_WEAK_PREFIX}*`,
      'COUNT',
      '200',
    ])) as unknown;
    if (!Array.isArray(res)) break;
    // Upstash 游标绝大多数为 string；个别网关/代理可能回 number，统一 String 化，杜绝 '1'!==1 提前退出
    cursor = String(res[0]);
    const batch = Array.isArray(res[1]) ? (res[1] as string[]) : [];
    for (const k of batch) {
      if (typeof k !== 'string') continue;
      if (opts?.city) {
        const segCity = k.slice(CAMP_WEAK_PREFIX.length).split(':')[0];
        if (segCity !== opts.city) continue;
      }
      keys.push(k);
    }
    if (cursor === '0') break;
  }
  return keys;
}

/** SCAN 遍历所有 camp_weak:* key，聚合全部薄弱条目（可选按城市过滤） */
export async function scanAllWeakEntries(opts?: { city?: string; timeoutMs?: number }): Promise<WeakEntry[]> {
  const keys = await listWeakKeys(opts);
  if (keys.length === 0) return [];
  // MGET 批量读取，一次命令取多 key，避免几十次串行往返；大 key 按 20 个一批分治
  const all: WeakEntry[] = [];
  const CHUNK = 20;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    let raws: unknown[];
    try {
      raws =
        ((await upstashCommand(['MGET', ...chunk], { timeoutMs: opts?.timeoutMs })) as unknown[]) || [];
    } catch (err) {
      console.warn(`[camp-weak] MGET 失败（跳过本批）: batch=${i}`, err instanceof Error ? err.message : err);
      continue;
    }
    for (let b = 0; b < chunk.length; b += 1) {
      const k = chunk[b];
      const raw = raws[b] as string | null;
      if (typeof raw !== 'string' || !raw) {
        if (raw !== null) console.warn(`[camp-weak] MGET 返回空/非字符串: ${k}`);
        continue;
      }
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const e of arr) {
            if (e && typeof e.id === 'string') all.push(e as WeakEntry);
          }
        } else {
          console.warn(`[camp-weak] key 内容非数组: ${k}`);
        }
      } catch (err) {
        console.warn(`[camp-weak] key JSON 解析失败（跳过）: ${k}`, err);
      }
    }
  }
  // 统一按提交时间倒序（新错的在前）；同时间按 id 稳定排序
  all.sort((a, b) => {
    if (a.submittedAt !== b.submittedAt) return a.submittedAt < b.submittedAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
  return all;
}
