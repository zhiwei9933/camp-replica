import { NextRequest, NextResponse } from 'next/server';
import { upstashCommand } from '@/lib/upstash';
import { isAuthorizedAdmin } from '@/lib/admin-auth';
import { CAMP_WEAK_PREFIX } from '@/lib/camp-weak';
import { invalidateOverviewSnapshot } from '@/lib/camp-admin-agg';
import { invalidateLeaderboardSnapshot } from '@/lib/camp-leaderboard-agg';
import { readAllResults, type SubLevelResult } from '../../camp/submit-result/route';

const RESULTS_KEY = 'camp_results';
const PROGRESS_PREFIX = 'camp_progress:';
const RECORDINGS_KEY = 'camp_recordings';
const AUDIT_KEY = 'camp_admin_audit';

interface DeleteBody {
  city?: unknown;
  staffName?: unknown;
  confirmName?: unknown;
  operator?: unknown;
}

interface DeletedRecord {
  subId: string;
  bestScore: number;
  examScore: number;
  passed: boolean;
  submittedAt?: string;
  stars?: number;
}

/**
 * 删除前预览：需管理口令。返回该学员名下将被删除的数据清单（不改任何数据）。
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ success: false, error: '无管理权限或管理口令缺失/错误' }, { status: 401 });
  }
  const city = req.nextUrl.searchParams.get('city')?.trim() || '';
  const staffName = req.nextUrl.searchParams.get('staffName')?.trim() || '';
  if (!city || !staffName) {
    return NextResponse.json({ success: false, error: '缺少 city 或 staffName' }, { status: 400 });
  }

  const weakKey = `${CAMP_WEAK_PREFIX}${city}:${staffName}`;
  const progressKey = `${PROGRESS_PREFIX}${city}:${staffName}`;

  let results: SubLevelResult[] = [];
  try {
    const all = await readAllResults({ timeoutMs: 60000 });
    results = all.filter((r) => r.city === city && r.staffName === staffName);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `读取成绩失败：${err instanceof Error ? err.message : '未知错误'}` },
      { status: 502 },
    );
  }

  let weakCount = 0;
  try {
    const raw = (await upstashCommand(['GET', weakKey], { timeoutMs: 8000 })) as string | null;
    if (typeof raw === 'string' && raw) weakCount = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw).length : 0;
  } catch {
    weakCount = 0;
  }
  let hasProgress = false;
  try {
    const p = (await upstashCommand(['EXISTS', progressKey], { timeoutMs: 8000 })) as number;
    hasProgress = p === 1;
  } catch {
    hasProgress = false;
  }

  return NextResponse.json({
    success: true,
    city,
    staffName,
    resultCount: results.length,
    subIds: results.map((r) => r.subId),
    bestScoreSum: results.reduce((s, r) => s + (Number(r.bestScore) || 0), 0),
    passedCount: results.filter((r) => (Number(r.bestScore) || 0) >= 70).length,
    weakCount,
    hasProgress,
  });
}

/**
 * 彻底删除单个离职学员在「专业知识考核系统(camp)」中的全部数据。
 * 一次只删一人，必须：① 管理口令；② 手动输入姓名完全匹配。
 * 精确按 city+staffName 过滤，绝不波及其他学员；不动 training_results/quiz_results。
 */
export async function POST(req: NextRequest) {
  // 1) 服务端管理鉴权（学员免密身份不可调用）
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ success: false, error: '无管理权限或管理口令缺失/错误' }, { status: 401 });
  }

  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ success: false, error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const staffName = typeof body.staffName === 'string' ? body.staffName.trim() : '';
  const confirmName = typeof body.confirmName === 'string' ? body.confirmName.trim() : '';
  const operator = typeof body.operator === 'string' && body.operator.trim() ? body.operator.trim() : '管理员';

  if (!city || !staffName) {
    return NextResponse.json({ success: false, error: '缺少 city 或 staffName' }, { status: 400 });
  }
  // 2) 二次确认：必须手动输入完全一致的姓名
  if (confirmName !== staffName) {
    return NextResponse.json(
      { success: false, error: '姓名确认不匹配，请手动输入与该学员完全一致的姓名' },
      { status: 400 },
    );
  }

  const weakKey = `${CAMP_WEAK_PREFIX}${city}:${staffName}`;
  const progressKey = `${PROGRESS_PREFIX}${city}:${staffName}`;

  // 3) 原子地从大 key camp_results 中精确移除该 city+staffName 的所有记录。
  //    在 Redis 内读-过滤-回写，单命令原子执行，避免与并发提交的读写竞争；
  //    其他学员记录原样保留。
  const REMOVE_LUA = `
local raw = redis.call('GET', KEYS[1])
local removed = {}
if raw then
  local data = cjson.decode(raw)
  local kept = {}
  for _, r in ipairs(data) do
    if tostring(r['city'] or '') == ARGV[1] and tostring(r['staffName'] or '') == ARGV[2] then
      table.insert(removed, {
        subId = tostring(r['subId'] or ''),
        bestScore = tonumber(r['bestScore']) or 0,
        examScore = tonumber(r['examScore']) or 0,
        passed = (tonumber(r['bestScore']) or 0) >= 70,
        submittedAt = tostring(r['submittedAt'] or ''),
        stars = tonumber(r['stars']) or 0
      })
    else
      table.insert(kept, r)
    end
  end
  redis.call('SET', KEYS[1], cjson.encode(kept))
  return cjson.encode({ keptCount = #kept, removed = removed })
end
return cjson.encode({ keptCount = 0, removed = {} })
`;

  let payload: { keptCount: number; removed: DeletedRecord[] };
  try {
    const encoded = (await upstashCommand(['EVAL', REMOVE_LUA, '1', RESULTS_KEY, city, staffName], {
      timeoutMs: 30000,
    })) as string;
    const parsed = JSON.parse(encoded) as { keptCount: number; removed: DeletedRecord[] };
    payload = {
      keptCount: parsed.keptCount ?? 0,
      removed: Array.isArray(parsed.removed) ? parsed.removed : [],
    };
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `删除成绩失败：${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 },
    );
  }

  // 若该人在成绩库中不存在任何记录，视为目标不存在，拒绝执行（防止误删/空删）
  if (payload.removed.length === 0) {
    return NextResponse.json(
      { success: false, error: `成绩库中未找到 ${city}/${staffName} 的任何记录，已中止（未删除任何数据）` },
      { status: 404 },
    );
  }

  // 4) 删除该学员的个人 key：薄弱/错题、学练打点
  let weakDeleted = 0;
  let progressDeleted = 0;
  try {
    weakDeleted = (await upstashCommand(['DEL', weakKey])) as number;
  } catch (e) {
    console.warn('[delete-student] 删薄弱 key 失败', weakKey, e instanceof Error ? e.message : e);
  }
  try {
    progressDeleted = (await upstashCommand(['DEL', progressKey])) as number;
  } catch (e) {
    console.warn('[delete-student] 删进度 key 失败', progressKey, e instanceof Error ? e.message : e);
  }

  // 5) 从遗留录音大 key（camp_recordings，7 天 TTL）中按 employee+city 精确过滤
  let recordingsRemoved = 0;
  try {
    const REC_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local data = cjson.decode(raw)
local kept = {}
local removed = 0
for _, r in ipairs(data) do
  if tostring(r['city'] or '') == ARGV[1] and tostring(r['employee'] or '') == ARGV[2] then
    removed = removed + 1
  else
    table.insert(kept, r)
  end
end
redis.call('SET', KEYS[1], cjson.encode(kept))
return removed
`;
    recordingsRemoved = (await upstashCommand(['EVAL', REC_LUA, '1', RECORDINGS_KEY, city, staffName], {
      timeoutMs: 15000,
    })) as number;
  } catch (e) {
    // 录音为遗留功能，失败不阻断主流程
    console.warn('[delete-student] 清理录音记录失败', e instanceof Error ? e.message : e);
  }

  // 6) 删除快照（用于删除前总分核对）
  const removedSubs = payload.removed.map((r) => r.subId);
  const bestScoreSum = payload.removed.reduce((sum, r) => sum + (Number(r.bestScore) || 0), 0);
  const passedCount = payload.removed.filter((r) => r.passed).length;
  const lastSubmittedAt =
    payload.removed
      .map((r) => r.submittedAt)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null;

  // 7) 审计留痕（独立 key，不随学员删除）。仅存关键快照，不含作答原文。
  const auditEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action: 'delete_student',
    project: 'camp',
    city,
    staffName,
    operator,
    deletedAt: new Date().toISOString(),
    snapshot: {
      resultCount: payload.removed.length,
      subIds: removedSubs,
      bestScoreSum,
      passedCount,
      lastSubmittedAt,
      weakKeyDeleted: weakDeleted > 0,
      progressKeyDeleted: progressDeleted > 0,
      recordingsRemoved,
    },
  };
  let auditSaved = false;
  try {
    const APPEND_LUA = `
local raw = redis.call('GET', KEYS[1])
local list = {}
if raw then
  local ok, parsed = pcall(cjson.decode, raw)
  if ok and type(parsed) == 'table' then list = parsed end
end
table.insert(list, 1, cjson.decode(ARGV[1]))
-- 仅保留最近 500 条审计
if #list > 500 then
  local trimmed = {}
  for i = 1, 500 do trimmed[i] = list[i] end
  list = trimmed
end
redis.call('SET', KEYS[1], cjson.encode(list))
return #list
`;
    const auditCount = (await upstashCommand(['EVAL', APPEND_LUA, '1', AUDIT_KEY, JSON.stringify(auditEntry)], {
      timeoutMs: 10000,
    })) as number;
    auditSaved = typeof auditCount === 'number';
  } catch (e) {
    console.error('[delete-student] 审计留痕失败', e instanceof Error ? e.message : e);
  }

  // 8) 失效并后台重建排行榜 / 后台总览聚合缓存，确保已删学员立即从榜单/名单消失
  try {
    invalidateOverviewSnapshot();
    invalidateLeaderboardSnapshot();
  } catch (e) {
    console.warn('[delete-student] 刷新聚合缓存失败', e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    success: true,
    deleted: { city, staffName },
    resultRecordsRemoved: payload.removed.length,
    removedSubIds: removedSubs,
    bestScoreSumBeforeDelete: bestScoreSum,
    weakKeyDeleted: weakDeleted > 0,
    progressKeyDeleted: progressDeleted > 0,
    recordingsRemoved,
    remainingResultCount: payload.keptCount,
    auditSaved,
  });
}
