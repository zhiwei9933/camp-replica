import { NextRequest, NextResponse } from 'next/server';
import {
  computeLeaderEntries,
  getLeaderSnapshot,
  readWarmCache,
  readCampResults,
  scheduleLeaderboardRefresh,
  sortLeaderEntries,
  STALE_MS,
  type LeaderEntry,
} from '@/lib/camp-leaderboard-agg';

function startOfWeek(): number {
  const now = new Date();
  const day = now.getDay() || 7; // 周一为一周开始
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - (day - 1));
  return now.getTime();
}

function startOfMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

function thresholdFor(period: string): number {
  if (period === 'week') return startOfWeek();
  if (period === 'month') return startOfMonth();
  return 0; // all / total
}

function filterAndSort(entries: LeaderEntry[], threshold: number): LeaderEntry[] {
  const filtered = entries.filter((e) => {
    const t = new Date(e.updatedAt).getTime();
    return !Number.isNaN(t) && t >= threshold;
  });
  return sortLeaderEntries(filtered);
}

export async function GET(request: NextRequest) {
  try {
    const period = (request.nextUrl.searchParams.get('period') as string) || 'week';
    const threshold = thresholdFor(period);

    const snap = getLeaderSnapshot();
    const now = Date.now();

    // 1) 内存快照新鲜 → 直接返回
    if (snap && now - snap.at <= STALE_MS) {
      return NextResponse.json({ success: true, entries: filterAndSort(snap.entries, threshold) });
    }

    // 2) 快照过期/缺失 → 触发后台刷新；有旧快照先返回略旧数据
    scheduleLeaderboardRefresh();
    if (snap) {
      return NextResponse.json({ success: true, entries: filterAndSort(snap.entries, threshold) });
    }

    // 3) 完全冷启动：尝试读 Redis 暖缓存（短超时，读不到不拖慢）
    const warm = await readWarmCache(3000).catch(() => null);
    if (warm) {
      return NextResponse.json({ success: true, entries: filterAndSort(warm.entries, threshold) });
    }

    // 4) 最后兜底：同步短超时读一次（算不出来就走 warming，绝不长时间阻塞）
    try {
      const records = await readCampResults(6000);
      const entries = computeLeaderEntries(records);
      return NextResponse.json({ success: true, entries: filterAndSort(entries, threshold) });
    } catch {
      return NextResponse.json({ success: true, entries: [], warming: true });
    }
  } catch (error) {
    console.error('[camp/leaderboard GET] Error:', error);
    return NextResponse.json({ success: false, entries: [], error: String(error) });
  }
}