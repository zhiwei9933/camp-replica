// 训练营排行榜聚合缓存模块
//
// 背景：排行榜直接读 camp_results（单 key 大字符串）每次请求都极慢（约 21s+，且有 upstash 8s 超时风险）。
// 与后台 overview 同构，这里也改为「进程内快照 + 单飞后台刷新 + Redis 暖缓存」：
// - 后台刷新读大 key 用宽超时，把每名学员的 totalScore / updatedAt / reachTimeMs（首达时间）算好存内存。
// - GET 读内存快照毫秒返回，冷启动回退读暖缓存、否则快速返回 warming，绝不阻塞请求。
//
// 首达时间口径：总分 = 各小关最终 bestScore 合计（含首通奖励 +10，沿用排行榜现有总分口径，历史冻结不变）。
// 按提交时间顺序重放该学员「参与总分的小关最终记录」（每个小关取参与总分的那一条，即该小关最新提交），
// 逐条累计 bestScore（+ 该小关首通奖励），首次累计 ≥ 当前总分 的那条提交的 submittedAt 即首达时间。
// 因各小关最终分稳定、累计到位恰在最后一条参与小关，故首达时间 = 该学员完成当前总分所用的最后一次结算时间。
// 重考刷分使总分提高时，重放到提升后的最新小关才首次达到新总分 → 首达时间随之延后，符合「首次达到当前总分」。
import { upstashCommand } from './upstash';

export const LB_KEY = 'camp_results';
const LB_CACHE_KEY = 'camp_leaderboard_v1';
const STALE_MS = 90000;

interface RawRec {
  staffName?: string;
  city?: string;
  subId?: string;
  bestScore?: number;
  firstPassBonus?: boolean;
  submittedAt?: string;
}

export interface LeaderEntry {
  name: string;
  city: string;
  totalScore: number;
  updatedAt: string;
  /** 首次达到当前总分的毫秒时间戳；无法确定时为 null（兜底排有明确时间者之后） */
  reachTimeMs: number | null;
}

interface LbSnapshot {
  at: number;
  entries: LeaderEntry[];
}

function ms(s?: string): number {
  if (!s) return Number.NaN;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? Number.NaN : t;
}

export async function readCampResults(timeoutMs?: number): Promise<RawRec[]> {
  const raw = (await upstashCommand(['GET', LB_KEY], { timeoutMs })) as string | null;
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as RawRec[]) : [];
  } catch {
    return [];
  }
}

/** 纯函数聚合：输入原始成绩记录，输出全部学员的排行榜条目（不含周期过滤，过滤/排序在请求期内存做） */
export function computeLeaderEntries(records: RawRec[]): LeaderEntry[] {
  const grouped = new Map<string, RawRec[]>();
  for (const r of records) {
    if (!r?.staffName || !r?.subId) continue;
    const key = `${r.staffName}__${r.city || 'unknown'}`;
    const list = grouped.get(key) ?? [];
    list.push(r);
    grouped.set(key, list);
  }

  const entries: LeaderEntry[] = [];
  for (const [, list] of grouped) {
    const first = list[0];
    const name = first.staffName as string;
    const city = first.city || 'unknown';

    // 每个小关取「参与总分的那一条」= 该小关最新提交（沿用排行榜现有口径，历史冻结）
    const bestBySub = new Map<string, RawRec>();
    let updatedAtMs = 0;
    for (const rec of list) {
      const t = ms(rec.submittedAt);
      if (!Number.isNaN(t) && t > updatedAtMs) updatedAtMs = t;
      const ex = bestBySub.get(rec.subId as string);
      if (!ex || t > ms(ex.submittedAt)) bestBySub.set(rec.subId as string, rec);
    }

    // 总分（含首通奖励，现有口径不变）
    let totalScore = 0;
    for (const rec of bestBySub.values()) {
      totalScore += Number(rec.bestScore || 0);
      if (rec.firstPassBonus) totalScore += 10;
    }

    // 首达时间：按时间重放参与总分的小关最终记录，累计首次 >= 总分的那条时间
    const contrib = [...bestBySub.values()]
      .filter((r) => !Number.isNaN(ms(r.submittedAt)))
      .sort((a, b) => ms(a.submittedAt) - ms(b.submittedAt));
    let reachTimeMs: number | null = null;
    if (contrib.length > 0) {
      let cum = 0;
      for (const rec of contrib) {
        cum += Number(rec.bestScore || 0) + (rec.firstPassBonus ? 10 : 0);
        if (cum >= totalScore) {
          reachTimeMs = ms(rec.submittedAt);
          break;
        }
      }
    }

    entries.push({
      name,
      city,
      totalScore,
      updatedAt: updatedAtMs ? new Date(updatedAtMs).toISOString() : '',
      reachTimeMs,
    });
  }
  return entries;
}

/**
 * 排行榜排序：总分降序 → 首达时间升序（先达到者领先）→ 无首达者排有首达者之后 → 姓名/城市稳定。
 * 供各展示入口复用，保证口径一致。
 */
export function sortLeaderEntries(entries: LeaderEntry[]): LeaderEntry[] {
  return [...entries].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    // 并列：a 有明确首达时间
    const aR = a.reachTimeMs;
    const bR = b.reachTimeMs;
    if (aR !== null && bR !== null) {
      if (aR !== bR) return aR - bR;
    } else if (aR !== null && bR === null) {
      return -1;
    } else if (aR === null && bR !== null) {
      return 1;
    }
    // 均有/均无首达时间再按姓名、城市稳定
    const nc = a.name.localeCompare(b.name, 'zh');
    if (nc !== 0) return nc;
    return a.city.localeCompare(b.city, 'zh');
  });
}

// ===== 进程内快照 + 单飞后台刷新 + Redis 暖缓存 =====
let snapshot: LbSnapshot | null = null;
let refreshPromise: Promise<void> | null = null;

export function getLeaderSnapshot(): LbSnapshot | null {
  return snapshot;
}

export async function readWarmCache(timeoutMs?: number): Promise<LbSnapshot | null> {
  const raw = (await upstashCommand(['GET', LB_CACHE_KEY], { timeoutMs })) as string | null;
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const p = JSON.parse(raw) as LbSnapshot;
    return p && typeof p.at === 'number' && Array.isArray(p.entries) ? p : null;
  } catch {
    return null;
  }
}

async function writeWarmCache(p: LbSnapshot): Promise<void> {
  await upstashCommand(['SET', LB_CACHE_KEY, JSON.stringify(p)]);
}

async function doRefresh(): Promise<void> {
  const started = Date.now();
  try {
    const records = await readCampResults(60000);
    const entries = computeLeaderEntries(records);
    snapshot = { at: Date.now(), entries };
    void writeWarmCache(snapshot).catch((e) =>
      console.warn('[camp-leaderboard] 写暖缓存失败', e instanceof Error ? e.message : e),
    );
    console.log(`[camp-leaderboard] 后台刷新完成 ms=${Date.now() - started} entries=${entries.length}`);
  } catch (err) {
    console.error(
      `[camp-leaderboard] 后台刷新失败 ms=${Date.now() - started}`,
      err instanceof Error ? err.message : err,
    );
  }
}

/** 单飞触发后台刷新，不阻塞请求 */
export function scheduleLeaderboardRefresh(): void {
  if (refreshPromise) return;
  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });
}

/**
 * 数据变更（如删除学员）后调用：清掉进程内快照与 Redis 暖缓存，并后台重建。
 * 保证已删学员不会继续残留在排行榜。
 */
export function invalidateLeaderboardSnapshot(): void {
  snapshot = null;
  void upstashCommand(['DEL', LB_CACHE_KEY]).catch((e) =>
    console.warn('[camp-leaderboard] 删除暖缓存失败', e instanceof Error ? e.message : e),
  );
  scheduleLeaderboardRefresh();
}

export { STALE_MS };