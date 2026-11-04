import { NextRequest, NextResponse } from 'next/server';
import { upstashCommand } from '@/lib/upstash';
import { verifyAdmin, canAccessCity } from '@/lib/admin-auth';
import { invalidateOverviewSnapshot } from '@/lib/camp-admin-agg';
import { CAMP_WEAK_PREFIX } from '@/lib/camp-weak';

/**
 * 后台：删除「单条」成绩记录（不删整个学员）。
 *
 * 三类数据源各对应一个 type：
 * - camp      → camp_results    （训练营闯关成绩，按 city + staffName + subId 精确定位）
 * - quiz      → quiz_results    （模拟对话/知识考核，按 staffName + chapterId + submittedAt）
 * - training  → training_results（模拟训练，按 staffName + roundNumber + submittedAt）
 *
 * 鉴权：必须已登录；项目主管只能删本项目（按 city 校验）。
 * 只删命中那一条，绝不波及其他记录。
 */

const CAMP_RESULTS_KEY = 'camp_results';
const QUIZ_RESULTS_KEY = 'quiz_results';
const TRAINING_RESULTS_KEY = 'training_results';

type RecordType = 'camp' | 'quiz' | 'training';

interface DeleteBody {
  type?: unknown;
  city?: unknown;
  staffName?: unknown;
  /** camp=subId；quiz=chapterId；training=roundNumber */
  key?: unknown;
  /** 精确到单次提交，避免同名多条被误删 */
  submittedAt?: unknown;
}

/** 从 Redis 大 key 中原子移除命中记录，返回移除条数 */
async function removeFromKey(opts: {
  redisKey: string;
  lua: string;
  args: string[];
  timeoutMs: number;
}): Promise<number> {
  const res = await upstashCommand(
    ['EVAL', opts.lua, '1', opts.redisKey, ...opts.args],
    { timeoutMs: opts.timeoutMs },
  );
  if (typeof res === 'number') return res;
  if (typeof res === 'string') {
    try {
      const parsed = JSON.parse(res) as number | { removed?: number };
      if (typeof parsed === 'number') return parsed;
      return Number(parsed?.removed ?? 0) || 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

export async function POST(req: NextRequest) {
  // 1) 鉴权
  const identity = verifyAdmin(req);
  if (!identity) {
    return NextResponse.json({ success: false, error: '未登录或登录已过期' }, { status: 401 });
  }

  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ success: false, error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const type = typeof body.type === 'string' ? (body.type as RecordType) : null;
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const staffName = typeof body.staffName === 'string' ? body.staffName.trim() : '';
  const key = typeof body.key === 'string' ? body.key.trim() : String(body.key ?? '').trim();
  const submittedAt = typeof body.submittedAt === 'string' ? body.submittedAt.trim() : '';

  if (!type || !['camp', 'quiz', 'training'].includes(type)) {
    return NextResponse.json({ success: false, error: 'type 必须是 camp / quiz / training' }, { status: 400 });
  }
  if (!staffName || !key) {
    return NextResponse.json({ success: false, error: '缺少 staffName 或 key' }, { status: 400 });
  }
  if (city && !canAccessCity(identity, city)) {
    return NextResponse.json({ success: false, error: '只能删除本项目的数据' }, { status: 403 });
  }

  try {
    let removed = 0;

    if (type === 'camp') {
      const lua = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local data = cjson.decode(raw)
local kept = {}
local removed = 0
for _, r in ipairs(data) do
  local hit = tostring(r['staffName'] or '') == ARGV[1]
    and tostring(r['subId'] or '') == ARGV[2]
  if hit and ARGV[3] ~= '' then
    hit = tostring(r['city'] or '') == ARGV[3]
  end
  if hit then
    removed = removed + 1
  else
    table.insert(kept, r)
  end
end
if removed > 0 then redis.call('SET', KEYS[1], cjson.encode(kept)) end
return removed
`;
      removed = await removeFromKey({
        redisKey: CAMP_RESULTS_KEY,
        lua,
        args: [staffName, key, city],
        timeoutMs: 30000,
      });
    } else if (type === 'quiz') {
      const lua = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local data = cjson.decode(raw)
local kept = {}
local removed = 0
for _, r in ipairs(data) do
  local hit = tostring(r['staffName'] or '') == ARGV[1]
    and tostring(r['chapterId'] or '') == ARGV[2]
  if hit and ARGV[3] ~= '' then
    hit = tostring(r['submittedAt'] or '') == ARGV[3]
  end
  if hit then
    removed = removed + 1
  else
    table.insert(kept, r)
  end
end
if removed > 0 then redis.call('SET', KEYS[1], cjson.encode(kept)) end
return removed
`;
      removed = await removeFromKey({
        redisKey: QUIZ_RESULTS_KEY,
        lua,
        args: [staffName, key, submittedAt],
        timeoutMs: 15000,
      });
    } else {
      const lua = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local data = cjson.decode(raw)
local kept = {}
local removed = 0
for _, r in ipairs(data) do
  local hit = tostring(r['staffName'] or '') == ARGV[1]
    and tostring(r['roundNumber'] or '') == ARGV[2]
  if hit and ARGV[3] ~= '' then
    hit = tostring(r['submittedAt'] or '') == ARGV[3]
  end
  if hit then
    removed = removed + 1
  else
    table.insert(kept, r)
  end
end
if removed > 0 then redis.call('SET', KEYS[1], cjson.encode(kept)) end
return removed
`;
      removed = await removeFromKey({
        redisKey: TRAINING_RESULTS_KEY,
        lua,
        args: [staffName, key, submittedAt],
        timeoutMs: 15000,
      });
    }

    if (removed === 0) {
      return NextResponse.json(
        { success: false, error: '未找到匹配的记录（可能已被删除，请刷新后重试）' },
        { status: 404 },
      );
    }

    // camp 单条删除时，同步清掉该条对应的薄弱作答条目，避免总览里残留
    if (type === 'camp' && city) {
      try {
        const weakLua = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local data = cjson.decode(raw)
local kept = {}
local removed = 0
for _, e in ipairs(data) do
  local hit = tostring(e['subId'] or '') == ARGV[1]
  if hit and ARGV[2] ~= '' then
    hit = tostring(e['submittedAt'] or '') == ARGV[2]
  end
  if hit then
    removed = removed + 1
  else
    table.insert(kept, e)
  end
end
if removed > 0 then redis.call('SET', KEYS[1], cjson.encode(kept)) end
return removed
`;
        await removeFromKey({
          redisKey: `${CAMP_WEAK_PREFIX}${city}:${staffName}`,
          lua: weakLua,
          args: [key, submittedAt],
          timeoutMs: 15000,
        });
      } catch (e) {
        console.warn('[delete-record] 清理薄弱条目失败（不影响成绩删除）', e instanceof Error ? e.message : e);
      }
    }

    // camp 数据变了，总览快照要失效重建
    if (type === 'camp') {
      try {
        invalidateOverviewSnapshot();
      } catch (e) {
        console.warn('[delete-record] 刷新总览快照失败', e instanceof Error ? e.message : e);
      }
    }

    return NextResponse.json({ success: true, removed });
  } catch (error) {
    console.error('[admin/delete-record] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: `删除失败：${message}` }, { status: 500 });
  }
}
