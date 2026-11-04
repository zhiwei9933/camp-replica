// 后台 overview 聚合缓存模块
//
// 背景：camp_results 是一个不断增大的单 key 字符串（现已 ~1.1MB），每次 overview 请求都完整读回再聚合，
// 在 Upstash REST 大 payload 下会消耗 30s+，撞上平台网关超时（http 000 / 后台 30s 转圈挂死）。
//
// 方案：把「全量聚合结果」持久化到一个小的 Redis 缓存 key（camp_admin_overview_v1）：
// - GET 请求优先读缓存（几 ms 返回），命中即回；数据略陈旧也可接受（STALE_MS 内直接复用）。
// - 缓存缺失/过期时，异步触发后台刷新（单飞，避免并发 stampede），本次请求快速返回（陈旧缓存或明确错误），绝不挂死。
// - 刷新在服务进程内执行（Next 常驻 server），不受单次 HTTP 请求 30s 墙限制，可用较长超时读完 1.1MB。
import { upstashCommand } from './upstash';
import { readAllResults, type SubLevelResult } from '@/app/api/camp/submit-result/route';
import { flattenSubLevels } from '@/lib/camp-data';
import { scanAllWeakEntries, type WeakEntry } from '@/lib/camp-weak';

const ALL_SUBS = flattenSubLevels().map((x) => x.sub);
const TOTAL_SUBLEVELS = ALL_SUBS.length;

const SUB_TITLES: Record<string, string> = Object.fromEntries(
  ALL_SUBS.map((s: { id: string; title: string }) => [s.id, s.title]),
);

export type CampEmployeeSummary = {
  staffName: string;
  city: string;
  totalSubLevels: number;
  completedCount: number;
  passedCount: number;
  totalScore: number;
  bestScoreSum: number;
  stars: number;
  /** 该员工已提交的简答题答案总数（按 breakdown.textScores 累加） */
  textAnswerCount: number;
  /** 自动评分为半分（0.5）、主管可复核的题数 */
  pendingReviewCount: number;
  /** 简答题答案为 0 分（命中率 <50%）的小关+题目列表 */
  weakAnswers: { subId: string; title: string; questionId: string; snippet: string }[];
  lastSubmittedAt: string | null;
  /** 首次达到当前 bestScoreSum 的毫秒时间戳；无法确定时为 null（并列排序次级键） */
  reachTimeMs: number | null;
};

export interface OverviewPayload {
  computedAt: number;
  totalResults: number;
  summary: CampEmployeeSummary[];
  weakEntries: WeakEntry[];
}

// 缓存 key 与新鲜度
export const OVERVIEW_CACHE_KEY = 'camp_admin_overview_v1';
export const STALE_MS = 90000;

function buildSummary(results: SubLevelResult[]): CampEmployeeSummary[] {
  const byEmp = new Map<string, SubLevelResult[]>();
  for (const r of results) {
    const key = `${r.city}::${r.staffName}`;
    const arr = byEmp.get(key) || [];
    arr.push(r);
    byEmp.set(key, arr);
  }

  const summary: CampEmployeeSummary[] = [];
  for (const [key, empResults] of byEmp) {
    const [empCity, empName] = key.split('::');
    let totalScore = 0;
    let bestScoreSum = 0;
    let stars = 0;
    let passedCount = 0;
    let lastSubmittedAt: string | null = null;
    let textAnswerCount = 0;
    let pendingReviewCount = 0;
    const weakAnswers: CampEmployeeSummary['weakAnswers'] = [];

    for (const r of empResults) {
      totalScore += r.bestScore || 0;
      bestScoreSum += r.bestScore || 0;
      stars += r.stars || 0;
      if ((r.bestScore || 0) >= 70) passedCount += 1;
      if (r.submittedAt && (!lastSubmittedAt || r.submittedAt > lastSubmittedAt)) {
        lastSubmittedAt = r.submittedAt;
      }
      const bd = r.examBreakdown as
        | { textScores?: { questionId: string; answer?: string; awarded: number }[] }
        | undefined;
      if (bd && Array.isArray(bd.textScores)) {
        for (const s of bd.textScores) {
          textAnswerCount += 1;
          if (s.awarded === 0.5) pendingReviewCount += 1;
          if (s.awarded === 0) {
            const snippet = (s.answer || '').slice(0, 60);
            weakAnswers.push({
              subId: r.subId,
              title: SUB_TITLES[r.subId] || r.subId,
              questionId: s.questionId,
              snippet,
            });
          }
        }
      }
    }

    // 首达时间：按提交时间重放该员工各关最终 bestScore，累计首次 >= bestScoreSum 即当前总分达成时间
    let reachTimeMs: number | null = null;
    {
      const timed = empResults
        .map((r) => ({ best: Number(r.bestScore || 0), at: r.submittedAt ? new Date(r.submittedAt).getTime() : NaN }))
        .filter((x) => !Number.isNaN(x.at))
        .sort((a, b) => a.at - b.at);
      let cum = 0;
      for (const x of timed) {
        cum += x.best;
        if (bestScoreSum > 0 && cum >= bestScoreSum) {
          reachTimeMs = x.at;
          break;
        }
      }
    }

    summary.push({
      staffName: empName,
      city: empCity,
      totalSubLevels: TOTAL_SUBLEVELS,
      completedCount: empResults.length,
      passedCount,
      totalScore,
      bestScoreSum,
      stars,
      textAnswerCount,
      pendingReviewCount,
      weakAnswers,
      lastSubmittedAt,
      reachTimeMs,
    });
  }

  // 排序：总分降序 → 首达时间升序（并列先达者领先）→ 无首达者排后 → 姓名/城市稳定（与排行榜口径一致）
  summary.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    const aR = a.reachTimeMs;
    const bR = b.reachTimeMs;
    if (aR !== null && bR !== null) {
      if (aR !== bR) return aR - bR;
    } else if (aR !== null && bR === null) {
      return -1;
    } else if (aR === null && bR !== null) {
      return 1;
    }
    const nc = a.staffName.localeCompare(b.staffName, 'zh');
    if (nc !== 0) return nc;
    return a.city.localeCompare(b.city, 'zh');
  });
  return summary;
}

/** 完整聚合：读全量成绩 + 全量薄弱条目（重读，供后台刷新用） */
export async function computeOverviewPayload(opts?: {
  timeoutMs?: number;
  weakTimeoutMs?: number;
}): Promise<OverviewPayload> {
  const results = await readAllResults({ timeoutMs: opts?.timeoutMs });
  // 薄弱作答是辅助信息：扫描失败不应拖垮整个总览，降级为空即可
  let weakEntries: WeakEntry[] = [];
  try {
    weakEntries = await scanAllWeakEntries({ timeoutMs: opts?.weakTimeoutMs });
  } catch (e) {
    console.warn('[camp-admin-agg] 薄弱条目扫描失败，降级为空', e instanceof Error ? e.message : e);
  }
  return {
    computedAt: Date.now(),
    totalResults: results.length,
    summary: buildSummary(results),
    weakEntries,
  };
}

export async function readCachedOverview(opts?: { timeoutMs?: number }): Promise<OverviewPayload | null> {
  const raw = (await upstashCommand(['GET', OVERVIEW_CACHE_KEY], { timeoutMs: opts?.timeoutMs })) as
    | string
    | null;
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const p = JSON.parse(raw) as OverviewPayload;
    if (p && typeof p.computedAt === 'number' && Array.isArray(p.summary)) return p;
    return null;
  } catch {
    return null;
  }
}

export async function writeCachedOverview(payload: OverviewPayload): Promise<boolean> {
  if (!payload || !Array.isArray(payload.summary)) return false;
  await upstashCommand(['SET', OVERVIEW_CACHE_KEY, JSON.stringify(payload)]);
  return true;
}

/** 刷新（核心聚合）执行体：读大 key 用宽超时，失败仅告警，绝不抛给调用方 */
async function doRefresh(): Promise<void> {
  const started = Date.now();
  try {
    const payload = await computeOverviewPayload({ timeoutMs: 60000, weakTimeoutMs: 60000 });
    memorySnapshot = { payload, at: Date.now() };
    void writeCachedOverview(payload).catch((e) =>
      console.warn('[camp-admin-agg] 写 Redis 暖缓存失败', e instanceof Error ? e.message : e),
    );
    console.log(`[camp-admin-agg] 后台刷新完成 ms=${Date.now() - started} total=${payload.totalResults} emp=${payload.summary.length} weak=${payload.weakEntries.length}`);
  } catch (err) {
    console.error(`[camp-admin-agg] 后台刷新失败 ms=${Date.now() - started}`, err instanceof Error ? err.message : err);
  }
}

let refreshPromise: Promise<void> | null = null;
/** 单飞触发后台刷新，返回立即（不阻塞请求）。并发/重复调用复用同一次任务 */
export function scheduleRefresh(): void {
  if (refreshPromise) return;
  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });
}

/** 进程内快照（主数据源）：聚合结果存在内存，GET 读取零 Redis 开销，环境无关、最快 */
let memorySnapshot: { payload: OverviewPayload; at: number } | null = null;
export function getMemorySnapshot(): { payload: OverviewPayload; at: number } | null {
  return memorySnapshot;
}

/**
 * 同步计算结果回填内存快照。
 * Serverless 环境（Netlify 等）每个请求可能是新实例，后台异步刷新跑不完就随实例销毁，
 * 只靠 scheduleRefresh 会一直停留在 warming；因此请求内同步算完必须回填，下一次请求可直接命中。
 */
export function setMemorySnapshot(payload: OverviewPayload): void {
  memorySnapshot = { payload, at: Date.now() };
}

/**
 * 数据变更（如删除学员）后调用：清掉进程内快照与 Redis 暖缓存并后台重建，
 * 保证后台名单/薄弱统计不再包含已删学员。
 */
export function invalidateOverviewSnapshot(): void {
  memorySnapshot = null;
  void upstashCommand(['DEL', OVERVIEW_CACHE_KEY]).catch((e) =>
    console.warn('[camp-admin-agg] 删除暖缓存失败', e instanceof Error ? e.message : e),
  );
  scheduleRefresh();
}