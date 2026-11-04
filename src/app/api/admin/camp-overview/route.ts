import { NextRequest, NextResponse } from 'next/server';
import {
  computeOverviewPayload,
  getMemorySnapshot,
  readCachedOverview,
  scheduleRefresh,
  setMemorySnapshot,
  writeCachedOverview,
  STALE_MS,
  type OverviewPayload,
  type CampEmployeeSummary,
} from '@/lib/camp-admin-agg';
import type { WeakEntry } from '@/lib/camp-weak';
import { verifyAdmin } from '@/lib/admin-auth';

/**
 * 主管后台：训练营完成度 + 薄弱作答总览
 *
 * 性能方案（修复线上 30s 挂死）：
 * - 底层成绩数据 camp_results（单 key，已达 ~1.1MB）每次完整读回再聚合会超过平台 30s 网关超时 → http 000。
 * - 于是聚合结果存**进程内快照**（主数据源）：GET 直接读内存，零 Redis 开销、毫秒级返回，任何网络下都稳定。
 * - 快照由**单飞后台刷新**填充/更新（读大 key 用 60s 宽超时，在常驻服务进程内跑，不受单次 HTTP 30s 墙限制）。
 * - 冷启动时：先触发后台刷新，若无内存快照，回退读 Redis 暖缓存（仍无则返回 503 warming，绝不阻塞挂死）。
 * - 城市/姓名筛选在快照完整结果上内存过滤；后端字段与旧结构一致（weakEntries / weakAnswers / weakCount / weakAggregationMs）。
 */
export async function GET(request: NextRequest) {
  try {
    const identity = verifyAdmin(request);
    if (!identity) {
      return NextResponse.json({ success: false, error: '未登录或登录已过期' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    // 项目主管强制锁定本项目，忽略前端传入的城市参数
    const city = identity.role === 'manager' ? (identity.city || '__none__') : searchParams.get('city') || '';
    const staffName = searchParams.get('staffName') || '';

    const snap = getMemorySnapshot();
    const now = Date.now();

    // 1) 内存快照新鲜 → 直接返回（毫秒级）
    if (snap && now - snap.at <= STALE_MS) {
      return respond(snap.payload, city, staffName, false);
    }

    // 2) 快照过期 / 缺失 → 请求内同步聚合。
    //    Serverless（Netlify）每次请求可能是新实例，后台异步刷新会随实例销毁而丢失，
    //    只靠 scheduleRefresh 会永远 warming；因此这里必须同步算完并回填快照。
    if (!snap) {
      try {
        const payload = await computeOverviewPayload({ timeoutMs: 20000, weakTimeoutMs: 15000 });
        setMemorySnapshot(payload);
        void writeCachedOverview(payload).catch(() => {});
        return respond(payload, city, staffName, false);
      } catch (computeErr) {
        console.error('[camp-admin-overview] 同步聚合失败', computeErr);
        // 同步失败才退回 Redis 暖缓存
        const cached = await readCachedOverview({ timeoutMs: 3000 }).catch(() => null);
        if (cached) return respond(cached, city, staffName, true);
        throw computeErr;
      }
    }

    // 3) 有旧快照：先返回略旧数据（快速），后台继续刷新
    scheduleRefresh();
    return respond(snap.payload, city, staffName, true);
  } catch (error) {
    console.error('[camp-admin-overview] error', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `查询失败: ${message}` },
      { status: 500 },
    );
  }
}

function respond(payload: OverviewPayload, city: string, staffName: string, stale: boolean) {
  let resultsCount = payload.totalResults;
  let summary: CampEmployeeSummary[] = payload.summary;
  if (city) summary = summary.filter((s) => s.city === city);
  if (staffName) {
    const q = staffName.toLowerCase();
    summary = summary.filter((s) => s.staffName.toLowerCase().includes(q));
  }

  let weakEntries: WeakEntry[] = payload.weakEntries;
  if (city) weakEntries = weakEntries.filter((w) => w.city === city);
  if (staffName) {
    const q = staffName.toLowerCase();
    weakEntries = weakEntries.filter((w) => w.staffName.toLowerCase().includes(q));
  }
  // 按提交时间倒序（新错在前）
  weakEntries = [...weakEntries].sort((a, b) =>
    a.submittedAt < b.submittedAt ? 1 : a.submittedAt > b.submittedAt ? -1 : 0,
  );
  if (city || staffName) {
    resultsCount = summary.reduce((n, s) => n + s.completedCount, 0);
  }

  return NextResponse.json({
    success: true,
    cached: true,
    stale,
    computedAt: payload.computedAt,
    totalResults: resultsCount,
    summary,
    weakEntries,
    // 兼容字段：部分前端/排查脚本读取 weakAnswers；同时返回聚合耗时基线便于排查
    weakAnswers: weakEntries,
    weakCount: weakEntries.length,
    weakAggregationMs: 0,
    aggregationSource: 'cache',
  });
}