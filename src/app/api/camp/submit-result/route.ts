import { NextRequest, NextResponse } from 'next/server';
import { upstashCommand } from '@/lib/upstash';
import type { ExamBreakdown } from '@/lib/camp-data';
import {
  appendWeakEntries,
  buildWeakEntriesFromBreakdown,
  getQuestionMetaMap,
} from '@/lib/camp-weak';
import { applyLLMFallback } from '@/lib/camp-llm-scoring';
import { verifyAdmin } from '@/lib/admin-auth';

export const RESULTS_KEY = 'camp_results';
// 考核成绩永久保留（直到主管明确清除），写入时不设置 TTL / EXPIRE

/** 单次考试明细 */
export interface AttemptRecord {
  /** 该次总评成绩（学+练+考） */
  score: number;
  /** 该次考核分 */
  examScore: number;
  stars: number;
  submittedAt: string;
  /** 该次是否达到通关线（70分） */
  passed: boolean;
}

export interface SubLevelResult {
  staffName: string;
  city: string;
  subId: string;
  /** 最终成绩：1次=该次；2次=两次算术平均（四舍五入）。旧字段名保留，值为最终成绩。 */
  bestScore: number;
  /** 最终星级，按最终成绩评定 */
  stars?: number;
  learnScore?: number;
  practiceScore?: number;
  /** 最终考核分（最近一次的考核分；总评以 bestScore 为准） */
  examScore?: number;
  /** 已用考试次数（旧数据无 attemptsList 时视为 1） */
  attempts?: number;
  /** 最大考试机会 */
  maxAttempts?: number;
  /** 每次考试明细（新规则数据；旧数据可能没有） */
  attemptsList?: AttemptRecord[];
  /** 首次通关奖励（首次达到70分即发放，重考不重复） */
  firstPassBonus?: boolean;
  /** 最近一次提交时间 */
  submittedAt: string;
  examBreakdown?: ExamBreakdown | null;
  /** 兼容历史：人工评分标记（录音时代遗留） */
  graded?: boolean;
  gradedAt?: string;
  gradedComment?: string | null;
}

interface SubmitResultBody {
  staffName?: string;
  city?: string;
  subId?: string;
  /** 本次考试的总评成绩 */
  score?: number;
  bestScore?: number;
  stars?: number;
  learnScore?: number;
  practiceScore?: number;
  examScore?: number;
  completedAt?: string;
  examBreakdown?: ExamBreakdown | null;
}

export const PASS_SCORE = 70;
export const MAX_ATTEMPTS = 2;

export function starFromScore(score: number): number {
  if (score >= 90) return 3;
  if (score >= 80) return 2;
  if (score >= PASS_SCORE) return 1;
  return 0;
}

/** 根据已有明细+本次成绩，生成最终成绩结构。纯函数，便于测试。 */
export function buildAttemptResult(
  existing: SubLevelResult | undefined,
  incoming: {
    staffName: string;
    city: string;
    subId: string;
    score: number;
    learnScore: number;
    practiceScore: number;
    examScore: number;
    submittedAt: string;
    examBreakdown: ExamBreakdown | null;
  },
): { record: SubLevelResult; rejected?: boolean } {
  // 兼容旧数据：没有 attemptsList 的已有记录，补出第一次明细
  let list: AttemptRecord[] = [];
  let firstPassBonus = false;
  if (existing) {
    if (Array.isArray(existing.attemptsList) && existing.attemptsList.length > 0) {
      list = existing.attemptsList.map((a) => ({ ...a }));
    } else if (typeof existing.bestScore === 'number') {
      list = [
        {
          score: existing.bestScore,
          examScore: existing.examScore ?? existing.bestScore,
          stars: existing.stars ?? starFromScore(existing.bestScore),
          submittedAt: existing.submittedAt,
          passed: existing.bestScore >= PASS_SCORE,
        },
      ];
    }
    firstPassBonus = !!existing.firstPassBonus || list.some((a) => a.passed);
  }

  if (list.length >= MAX_ATTEMPTS) {
    return { record: existing as SubLevelResult, rejected: true };
  }

  const thisPassed = incoming.score >= PASS_SCORE;
  // 首通奖励：本次或历史任一次考试首次达到通关线即发放（重考通关也算首通，仅发一次）
  if (thisPassed && !firstPassBonus) {
    firstPassBonus = true;
  }

  list.push({
    score: incoming.score,
    examScore: incoming.examScore,
    stars: starFromScore(incoming.score),
    submittedAt: incoming.submittedAt,
    passed: thisPassed,
  });

  const finalScore =
    list.length === 1
      ? list[0].score
      : Math.round(list.reduce((sum, a) => sum + a.score, 0) / list.length);

  return {
    record: {
      staffName: incoming.staffName,
      city: incoming.city,
      subId: incoming.subId,
      bestScore: finalScore,
      stars: starFromScore(finalScore),
      learnScore: incoming.learnScore,
      practiceScore: incoming.practiceScore,
      examScore: incoming.examScore,
      attempts: list.length,
      maxAttempts: MAX_ATTEMPTS,
      attemptsList: list,
      firstPassBonus,
      submittedAt: incoming.submittedAt,
      examBreakdown: incoming.examBreakdown,
    },
  };
}

export async function readAllResults(opts?: { timeoutMs?: number }): Promise<SubLevelResult[]> {
  const raw = await upstashCommand(['GET', RESULTS_KEY], { timeoutMs: opts?.timeoutMs });
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SubLevelResult[]) : [];
  } catch {
    return [];
  }
}

/**
 * 原子提交一次考试。基于 EVAL 读-改-写：
 * - 找到该员工+小关记录，已有 attempts>=2 时拒绝（返回 rejected）
 * - 否则追加明细、按平均规则重算最终成绩
 */
export async function submitAttempt(
  incoming: {
    staffName: string;
    city: string;
    subId: string;
    score: number;
    learnScore: number;
    practiceScore: number;
    examScore: number;
    submittedAt: string;
    examBreakdown: ExamBreakdown | null;
  },
): Promise<{ written: boolean; rejected: boolean; record?: SubLevelResult }> {
  const lua = `
local v = redis.call('GET', KEYS[1])
local arr = {}
if v then arr = cjson.decode(v) end
local existing = nil
local out = {}
for _, x in ipairs(arr) do
  if x.staffName == ARGV[1] and x.subId == ARGV[2] then
    existing = x
  else
    table.insert(out, x)
  end
end
local used = 0
if existing then
  if existing.attemptsList then
    used = #existing.attemptsList
  else
    used = 1
  end
end
if used >= 2 then
  return cjson.encode({written=false, rejected=true})
end
local inc = cjson.decode(ARGV[3])
local list = {}
local firstBonus = false
if existing then
  if existing.attemptsList and #existing.attemptsList > 0 then
    for _, a in ipairs(existing.attemptsList) do table.insert(list, a) end
  else
    table.insert(list, {
      score = existing.bestScore or 0,
      examScore = existing.examScore or existing.bestScore or 0,
      stars = existing.stars or 0,
      submittedAt = existing.submittedAt,
      passed = (existing.bestScore or 0) >= 70
    })
  end
  if existing.firstPassBonus == true then firstBonus = true end
end
for _, a in ipairs(list) do
  if a.passed == true then firstBonus = true end
end
local thisPassed = inc.score >= 70
if thisPassed and not firstBonus then firstBonus = true end
table.insert(list, {
  score = inc.score,
  examScore = inc.examScore,
  stars = inc.score >= 90 and 3 or (inc.score >= 80 and 2 or (inc.score >= 70 and 1 or 0)),
  submittedAt = inc.submittedAt,
  passed = thisPassed
})
local finalScore = list[1].score
if #list == 2 then
  finalScore = math.floor((list[1].score + list[2].score) / 2 + 0.5)
end
local finalStars = finalScore >= 90 and 3 or (finalScore >= 80 and 2 or (finalScore >= 70 and 1 or 0))
local rec = {
  staffName = inc.staffName,
  city = inc.city,
  subId = inc.subId,
  bestScore = finalScore,
  stars = finalStars,
  learnScore = inc.learnScore,
  practiceScore = inc.practiceScore,
  examScore = inc.examScore,
  attempts = #list,
  maxAttempts = 2,
  attemptsList = list,
  firstPassBonus = firstBonus,
  submittedAt = inc.submittedAt,
  examBreakdown = inc.examBreakdown
}
table.insert(out, rec)
redis.call('SET', KEYS[1], cjson.encode(out))
return cjson.encode({written=true, rejected=false, record=rec})
`;
  const payload = {
    staffName: incoming.staffName,
    city: incoming.city,
    subId: incoming.subId,
    score: Math.round(incoming.score),
    learnScore: incoming.learnScore,
    practiceScore: incoming.practiceScore,
    examScore: incoming.examScore,
    submittedAt: incoming.submittedAt,
    examBreakdown: incoming.examBreakdown,
  };
  const res = await upstashCommand([
    'EVAL',
    lua,
    '1',
    RESULTS_KEY,
    incoming.staffName,
    incoming.subId,
    JSON.stringify(payload),
  ]);
  if (typeof res === 'string') {
    try {
      const parsed = JSON.parse(res) as {
        written: boolean;
        rejected: boolean;
        record?: SubLevelResult;
      };
      return parsed;
    } catch {
      // fall through
    }
  }
  return { written: true, rejected: false };
}

// 后台评分/合并用的旧 upsert 入口保留（merge 模式）
export async function upsertResult(
  record: SubLevelResult,
  onConflict: 'replace' | 'skip-graded' | 'merge' = 'replace',
  mergePatch?: Partial<SubLevelResult>,
): Promise<{ written: boolean; existing?: SubLevelResult }> {
  const lua = `
local v = redis.call('GET', KEYS[1])
local arr = {}
if v then arr = cjson.decode(v) end
local existing = nil
local out = {}
for _, x in ipairs(arr) do
  if x.staffName == ARGV[1] and x.subId == ARGV[2] then
    existing = x
  else
    table.insert(out, x)
  end
end
local mode = ARGV[4]
local toInsert = nil
if existing then
  if mode == 'skip-graded' and existing.graded == true then
    toInsert = existing
  elseif mode == 'merge' then
    for k,val in pairs(cjson.decode(ARGV[5])) do existing[k] = val end
    toInsert = existing
  else
    toInsert = cjson.decode(ARGV[3])
  end
else
  toInsert = cjson.decode(ARGV[3])
end
table.insert(out, toInsert)
redis.call('SET', KEYS[1], cjson.encode(out))
return cjson.encode({written = true, existing = existing})
`;
  await upstashCommand([
    'EVAL',
    lua,
    '1',
    RESULTS_KEY,
    record.staffName,
    record.subId,
    JSON.stringify(record),
    onConflict,
    JSON.stringify(mergePatch || {}),
  ]);
  return { written: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SubmitResultBody;
    const {
      staffName,
      city,
      subId,
      score,
      bestScore,
      learnScore,
      practiceScore,
      examScore,
      completedAt,
      examBreakdown,
    } = body;

    const finalScore = typeof score === 'number' ? score : bestScore;
    if (!staffName || !subId || typeof finalScore !== 'number') {
      return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
    }

    // 服务端权威重算：对关键词漏判（ratio<0.5）的简答题做 LLM 语义兜底判分，
    // 取关键词/LLM 较高者，并重算考核分与总评。LLM 失败自动降级为纯关键词结果。
    let serverExamScore: number | null = null;
    let llmSummary: { graded: number; upgraded: number; failed: number } | null = null;
    const effectiveBreakdown: ExamBreakdown | null = examBreakdown ?? null;
    if (effectiveBreakdown && Array.isArray(effectiveBreakdown.textScores)) {
      try {
        const needLLM = effectiveBreakdown.textScores.some((t) => t.ratio < 0.5);
        if (needLLM) {
          const metaMap = getQuestionMetaMap();
          const { summary, examScore } = await applyLLMFallback(effectiveBreakdown, metaMap);
          llmSummary = summary;
          serverExamScore = examScore;
        }
      } catch (llmErr) {
        console.error('[camp/submit-result] LLM 兜底评分异常，降级为客户端评分', llmErr);
      }
    }

    const learn = learnScore ?? 20;
    const practice = practiceScore ?? 30;
    // 若服务端重算了考核分，以服务端为准；否则沿用客户端上报的 examScore
    const exam =
      serverExamScore !== null
        ? serverExamScore
        : examScore ?? Math.max(0, finalScore - learn - practice);
    const authoritativeScore = learn + practice + exam;

    const result = await submitAttempt({
      staffName,
      city: city || 'unknown',
      subId,
      score: authoritativeScore,
      learnScore: learn,
      practiceScore: practice,
      examScore: exam,
      submittedAt: completedAt || new Date().toISOString(),
      examBreakdown: effectiveBreakdown,
    });

    if (result.rejected) {
      return NextResponse.json(
        { success: false, error: '本关考试机会已用完（共2次）', rejected: true },
        { status: 409 },
      );
    }

    // 薄弱作答派生存储：同一次提交里，把本次未满分题目追加到该人 camp_weak key（永久）。
    // 失败不影响成绩写入结果（成绩已落库），仅记录日志，后台下次提交可补齐。
    try {
      const empCity = city || 'unknown';
      const empName = staffName;
      const empSubmittedAt =
        result.record?.submittedAt || completedAt || new Date().toISOString();
      const weakEntries = buildWeakEntriesFromBreakdown({
        staffName: empName,
        city: empCity,
        subId,
        submittedAt: empSubmittedAt,
        examBreakdown: result.record?.examBreakdown ?? effectiveBreakdown,
      });
      if (weakEntries.length > 0) {
        await appendWeakEntries(empCity, empName, weakEntries);
      }
    } catch (weakErr) {
      console.error('[camp/submit-result] 薄弱条目写入失败（不影响成绩）', weakErr);
    }

    return NextResponse.json({
      success: true,
      written: result.written,
      record: result.record,
      attemptsUsed: result.record?.attempts ?? 1,
      remainingAttempts: MAX_ATTEMPTS - (result.record?.attempts ?? 1),
      // 服务端权威成绩（若 LLM 兜底改判，客户端应以此回写本地）
      serverBestScore: result.record?.bestScore,
      serverExamScore: result.record?.examScore,
      serverExamBreakdown: result.record?.examBreakdown ?? null,
      llmSummary,
    });
  } catch (error) {
    console.error('[camp/submit-result] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const identity = verifyAdmin(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: '未登录或登录已过期', results: [] }, { status: 401 });
  }
  try {
    const results = await readAllResults();
    // 项目主管只能看到本项目数据
    const scoped = identity.role === 'manager'
      ? results.filter((r) => r.city === identity.city)
      : results;
    return NextResponse.json({ success: true, results: scoped });
  } catch (error) {
    console.error('[camp/submit-result GET] Error:', error);
    return NextResponse.json({ success: true, results: [], error: String(error) });
  }
}
