import { createLLM } from './llm';
import type { ExamBreakdown, TextQuestionScore } from './camp-data';

/**
 * 服务端简答题 LLM 语义兜底评分（仅在提交时运行，结果快照落库，前端不实时调用）。
 *
 * 规则：
 * - 关键词评分后，对 ratio < 0.5（关键词可能漏判）的简答题，调 LLM 语义判分；
 * - 取关键词结果与 LLM 结果的较高者作为 awarded，命中要点合并；
 * - LLM 判分同样三档（命中≥80% 满分 1、≥50% 半分 0.5、否则 0）；
 * - LLM 失败/超时/解析失败 → 降级为纯关键词结果，不影响提交流程。
 */

const LLM_MODEL = 'doubao-seed-2-0-mini-260215';
const LLM_TIMEOUT_MS = 15000;

export interface LLMGradeInput {
  question: string;
  referencePoints: string[];
  answer: string;
}

export interface LLMGradeResult {
  /** 0 / 0.5 / 1 系数 */
  awarded: 0 | 0.5 | 1;
  /** 命中的参考要点（原文要点或其概括） */
  matchedPoints: string[];
  /** 命中比例 0~1 */
  ratio: number;
  /** 一句话理由 */
  reason: string;
}

function clampAwarded(n: number): 0 | 0.5 | 1 {
  if (n >= 0.8) return 1;
  if (n >= 0.5) return 0.5;
  return 0;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('LLM timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * 调用 LLM 对单道简答题做语义判分。失败时抛出（由调用方 try/catch 降级）。
 */
export async function llmGradeTextAnswer(input: LLMGradeInput): Promise<LLMGradeResult> {
  const refList = input.referencePoints
    .map((p, i) => `${i + 1}. ${p}`)
    .join('\n');
  const prompt = `你是医疗客服培训的简答题评分员。请判断学员回答在【语义上】是否覆盖了参考答案要点。意思相近、用不同说法表达同一要点也算命中；不要因为字面用词不同而漏判，但完全跑题、答非所问的要点不得给分。

题目：${input.question}

参考要点：
${refList || '（无明确要点，按题意判断是否切题）'}

学员回答原文：
${input.answer}

只返回 JSON（不要任何额外文字），格式：
{"matchedPoints":["命中的要点1概括","命中的要点2概括"],"hitCount":命中要点数(整数),"totalPoints":${Math.max(input.referencePoints.length, 1)},"reason":"一句话说明命中/遗漏"}`;

  const client = createLLM();
  const messages = [{ role: 'user' as const, content: prompt }];
  const resp = await withTimeout(
    client.invoke(messages, { model: LLM_MODEL, temperature: 0.1 }),
    LLM_TIMEOUT_MS,
  );
  const content = (resp as { content?: string })?.content || '';
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('LLM 返回无法解析');
  const parsed = JSON.parse(m[0]) as {
    matchedPoints?: unknown;
    hitCount?: unknown;
    totalPoints?: unknown;
    reason?: unknown;
  };
  const total =
    typeof parsed.totalPoints === 'number' && parsed.totalPoints > 0
      ? parsed.totalPoints
      : Math.max(input.referencePoints.length, 1);
  const hit =
    typeof parsed.hitCount === 'number'
      ? Math.max(0, Math.min(parsed.hitCount, total))
      : Array.isArray(parsed.matchedPoints)
        ? Math.min((parsed.matchedPoints as unknown[]).length, total)
        : 0;
  const ratio = total > 0 ? hit / total : 0;
  return {
    awarded: clampAwarded(ratio),
    matchedPoints: Array.isArray(parsed.matchedPoints)
      ? (parsed.matchedPoints as unknown[]).map((x) => String(x)).slice(0, total)
      : [],
    ratio,
    reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 120) : '',
  };
}

export interface LLMFallbackSummary {
  /** 触发 LLM 的题数 */
  graded: number;
  /** LLM 结果高于关键词、实际改判的题数 */
  upgraded: number;
  /** LLM 调用失败/降级的题数 */
  failed: number;
}

/**
 * 对 examBreakdown 中 ratio<0.5 的简答题做 LLM 兜底判分，原地更新 textScores 与汇总分数。
 * 需要 questionMeta 提供题干/参考要点。标准关/结业考共用。
 *
 * @returns 汇总信息；breakdown 被原地修改。
 */
export async function applyLLMFallback(
  breakdown: ExamBreakdown,
  meta: Map<string, { question: string; referencePoints?: string[] }>,
): Promise<{ summary: LLMFallbackSummary; examScore: number }> {
  const summary: LLMFallbackSummary = { graded: 0, upgraded: 0, failed: 0 };
  if (!breakdown || !Array.isArray(breakdown.textScores)) {
    return { summary, examScore: recalcBreakdownScores(breakdown) };
  }

  for (const ts of breakdown.textScores) {
    if (ts.ratio >= 0.5) continue; // 关键词已判过/达标，无需 LLM
    const m = meta.get(ts.questionId);
    const answer = typeof ts.answer === 'string' ? ts.answer : '';
    if (!m || !answer.trim()) continue;
    summary.graded += 1;
    try {
      const llm = await llmGradeTextAnswer({
        question: m.question,
        referencePoints: m.referencePoints || [],
        answer,
      });
      ts.llmAwarded = llm.awarded;
      ts.llmMatchedPoints = llm.matchedPoints;
      ts.llmReason = llm.reason;
      const kwAwarded = ts.awarded;
      if (llm.awarded > kwAwarded) {
        ts.awarded = llm.awarded;
        ts.ratio = Math.max(ts.ratio, llm.ratio);
        // 命中要点合并去重（关键词命中 + LLM 命中要点）
        const merged = new Set<string>([
          ...(ts.matchedKeywords || []),
          ...llm.matchedPoints,
        ]);
        ts.matchedKeywords = Array.from(merged);
        ts.hitCount = Math.max(
          ts.hitCount,
          Math.round(llm.ratio * ts.totalPoints),
        );
        summary.upgraded += 1;
      }
    } catch (e) {
      summary.failed += 1;
      console.error(
        '[camp/llm-scoring] 简答题语义评分失败，降级为关键词结果',
        ts.questionId,
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  // 依据更新后的 textScores / objectiveScores 重算考核分（快照落库）
  const examScore = recalcBreakdownScores(breakdown);
  return { summary, examScore };
}

/**
 * 根据 textScores.awarded/maxScore 与 objectiveScores 重算考核得分。
 * 标准关：每题 maxScore 均等（50/题数）；结业考：各题 maxScore 已存。
 * @returns 重算后的考核总分
 */
export function recalcBreakdownScores(breakdown: ExamBreakdown): number {
  const objScore = (breakdown.objectiveScores || []).reduce(
    (sum, o) => sum + (o.score || 0),
    0,
  );
  let textScore = 0;
  let textMax = 0;
  for (const ts of breakdown.textScores || []) {
    const max =
      typeof ts.maxScore === 'number' ? ts.maxScore : breakdown.textPerPoint || 0;
    textScore += max * ts.awarded;
    textMax += max;
  }
  textScore = Math.round(textScore);
  const examScore = objScore + textScore;

  // 客观题汇总（兼容旧字段）
  breakdown.objectiveCorrect = (breakdown.objectiveScores || []).filter(
    (o) => o.isCorrect,
  ).length;
  breakdown.objectiveTotal = (breakdown.objectiveScores || []).length;
  // textPerPoint 用当前均值回填（标准关）；结业考各题分值不同，仅作兜底
  const textCount = (breakdown.textScores || []).length;
  if (textCount > 0) {
    breakdown.textPerPoint = Math.round((textMax / textCount) * 10) / 10;
  }
  return examScore;
}
