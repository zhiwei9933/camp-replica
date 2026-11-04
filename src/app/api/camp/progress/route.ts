import { NextRequest, NextResponse } from 'next/server';
import { upstashCommand } from '@/lib/upstash';
import { readAllResults } from '../submit-result/route';

// 每个员工一份进度快照 key：camp_progress:{city}:{staffName}
// 学习/练习打点属业务数据，永久保留（直到主管明确清除），不设置 TTL
const PROGRESS_PREFIX = 'camp_progress:';

export interface ProgressState {
  staffName: string;
  city: string;
  learnDone: string[]; // 已完成学习的小关
  practiceDone: string[]; // 已完成练习的小关
  lastActiveAt: string;
  updatedAt: string;
}

function keyOf(city: string, name: string): string {
  return `${PROGRESS_PREFIX}${city}:${name}`;
}

async function readProgress(city: string, name: string): Promise<ProgressState | null> {
  const raw = await upstashCommand(['GET', keyOf(city, name)]);
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as ProgressState;
    if (!parsed || !parsed.staffName) return null;
    return parsed;
  } catch {
    return null;
  }
}

// 原子合并打点：把新的 learnDone/practiceDone 并入已有集合
const UPSERT_LUA = `
local raw = redis.call('GET', KEYS[1])
local now = ARGV[2]
local state
if raw then
  state = cjson.decode(raw)
else
  state = { staffName = ARGV[3], city = ARGV[4], learnDone = {}, practiceDone = {}, lastActiveAt = now }
end
local patch = cjson.decode(ARGV[1])
if patch.learnDone then
  if state.learnDone == nil then state.learnDone = {} end
  local have = {}
  for _,v in ipairs(state.learnDone) do have[v] = true end
  for _,v in ipairs(patch.learnDone) do
    if not have[v] then
      have[v] = true
      table.insert(state.learnDone, v)
    end
  end
end
if patch.practiceDone then
  local have = {}
  for _,v in ipairs(state.practiceDone or {}) do have[v] = true end
  for _,v in ipairs(patch.practiceDone) do
    if not have[v] then
      have[v] = true
      if state.practiceDone == nil then state.practiceDone = {} end
      table.insert(state.practiceDone, v)
    end
  end
end
state.lastActiveAt = now
state.updatedAt = now
redis.call('SET', KEYS[1], cjson.encode(state))
return cjson.encode(state)
`;

async function upsertMarks(
  city: string,
  name: string,
  learnDone: string[],
  practiceDone: string[],
): Promise<ProgressState> {
  const now = new Date().toISOString();
  const res = await upstashCommand([
    'EVAL',
    UPSERT_LUA,
    '1',
    keyOf(city, name),
    JSON.stringify({ learnDone, practiceDone }),
    now,
    name,
    city,
  ]);
  if (typeof res === 'string') {
    try {
      return JSON.parse(res) as ProgressState;
    } catch {
      // fall through
    }
  }
  // fallback: 读-改-写
  const existing = (await readProgress(city, name)) || {
    staffName: name,
    city,
    learnDone: [],
    practiceDone: [],
    lastActiveAt: now,
    updatedAt: now,
  };
  const learnSet = new Set([...(existing.learnDone || []), ...learnDone]);
  const practiceSet = new Set([...(existing.practiceDone || []), ...practiceDone]);
  const next: ProgressState = {
    staffName: name,
    city,
    learnDone: [...learnSet],
    practiceDone: [...practiceSet],
    lastActiveAt: now,
    updatedAt: now,
  };
  await upstashCommand(['SET', keyOf(city, name), JSON.stringify(next)]);
  return next;
}

// GET /api/camp/progress?city=xx&staffName=xx
// 返回该员工完整进度快照：学习/练习打点来自 progress KV，考核成绩实时从 camp_results 聚合
export async function GET(request: NextRequest) {
  try {
    const city = (request.nextUrl.searchParams.get('city') || '').trim();
    const staffName = (request.nextUrl.searchParams.get('staffName') || '').trim();
    if (!city || !staffName) {
      return NextResponse.json({ success: false, error: '缺少 city 或 staffName 参数' }, { status: 400 });
    }

    const [state, allResults] = await Promise.all([
      readProgress(city, staffName),
      readAllResults(),
    ]);

    // 该员工的小关成绩（upsert 已保证同人同小关仅一条，bestScore 即最终成绩）
    const mine = allResults.filter(
      (r) => r.city === city && r.staffName === staffName,
    );

    const records: Record<
      string,
      {
        bestScore: number;
        stars: number;
        learnScore: number;
        practiceScore: number;
        examScore: number;
        attempts: number;
        maxAttempts: number;
        attemptsList: Array<{
          score: number;
          examScore: number;
          stars: number;
          submittedAt: string;
          passed: boolean;
        }>;
        remainingAttempts: number;
        firstPassBonus: boolean;
        completedAt: string;
      }
    > = {};
    let totalScore = 0;
    for (const r of mine) {
      const attempts = r.attempts ?? 1;
      const maxAttempts = r.maxAttempts ?? 2;
      records[r.subId] = {
        bestScore: r.bestScore || 0,
        stars: r.stars || 0,
        learnScore: r.learnScore || 0,
        practiceScore: r.practiceScore || 0,
        examScore: r.examScore || 0,
        attempts,
        maxAttempts,
        attemptsList: Array.isArray(r.attemptsList) ? r.attemptsList : [],
        remainingAttempts: Math.max(0, maxAttempts - attempts),
        firstPassBonus: !!r.firstPassBonus,
        completedAt: r.submittedAt || '',
      };
      totalScore += (r.bestScore || 0) + (r.firstPassBonus ? 10 : 0);
    }

    return NextResponse.json({
      success: true,
      staffName,
      city,
      learnDone: state?.learnDone || [],
      practiceDone: state?.practiceDone || [],
      records,
      totalScore,
      lastActiveAt: state?.lastActiveAt || null,
    });
  } catch (error) {
    console.error('[camp/progress GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

// POST /api/camp/progress
// body: { staffName, city, learnDone?: string[], practiceDone?: string[] }
// 学习/练习完成打点（原子合并）
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      staffName?: string;
      city?: string;
      learnDone?: string[];
      practiceDone?: string[];
    };
    const staffName = (body.staffName || '').trim();
    const city = (body.city || '').trim();
    if (!staffName || !city) {
      return NextResponse.json({ success: false, error: '缺少 staffName 或 city' }, { status: 400 });
    }
    const learnDone = Array.isArray(body.learnDone) ? body.learnDone.filter((x) => typeof x === 'string') : [];
    const practiceDone = Array.isArray(body.practiceDone)
      ? body.practiceDone.filter((x) => typeof x === 'string')
      : [];

    const state = await upsertMarks(city, staffName, learnDone, practiceDone);
    return NextResponse.json({
      success: true,
      learnDone: state.learnDone,
      practiceDone: state.practiceDone,
    });
  } catch (error) {
    console.error('[camp/progress POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
