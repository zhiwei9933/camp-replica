/**
 * 本地降级存储（复刻版新增）
 *
 * 背景：原项目所有成绩/进度/薄弱数据都落在 Upstash Redis（REST）。
 * 复刻版在没有配置 UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN 时，
 * 自动切到本文件实现的本地 KV：数据落盘到 /tmp/camp-local/kv.json，
 * 进程重启不丢；命令语义对齐 Upstash REST 返回格式。
 *
 * 覆盖的命令：GET / SET / DEL / EXISTS / EXPIRE / KEYS / MGET / SCAN / INCR / EVAL
 *
 * EVAL：项目里用到的 Lua 脚本是固定的几段（考试提交、成绩 upsert、
 * 删除学员三连），这里按脚本指纹分派到等价的 JS 实现，
 * 保证本地模式下业务逻辑与线上一致。
 *
 * 注意：这是单进程演示模式，不提供跨进程/多实例的原子性。
 * 生产请配置真实 Upstash Redis。
 */
import fs from 'fs';
import path from 'path';

interface Entry {
  /** 字符串值（Upstash 里本项目全部按字符串 JSON 存） */
  v: string;
  /** 过期时间戳（ms），无则永久 */
  exp?: number;
}

const DATA_DIR = process.env.CAMP_LOCAL_DATA_DIR || '/tmp/camp-local';
const DATA_FILE = process.env.CAMP_LOCAL_KV_FILE || path.join(DATA_DIR, 'kv.json');

let store: Map<string, Entry> | null = null;

function ensureLoaded(): Map<string, Entry> {
  if (store) return store;
  const map = new Map<string, Entry>();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, Entry>;
      const now = Date.now();
      for (const [k, v] of Object.entries(parsed)) {
        if (!v || typeof v.v !== 'string') continue;
        if (v.exp && v.exp <= now) continue;
        map.set(k, v);
      }
    }
  } catch (err) {
    console.warn('[local-store] 读取本地数据失败，按空库启动:', err instanceof Error ? err.message : err);
  }
  store = map;
  return map;
}

let writing = false;
let pending = false;

function persist(): void {
  // 同步落盘：本项目数据量小（单 key 最大 ~1MB），保证命令返回前数据已写入
  if (writing) {
    pending = true;
    return;
  }
  writing = true;
  try {
    const map = ensureLoaded();
    const now = Date.now();
    const out: Record<string, Entry> = {};
    for (const [k, v] of map.entries()) {
      if (v.exp && v.exp <= now) continue;
      out[k] = v;
    }
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(out), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.warn('[local-store] 落盘失败:', err instanceof Error ? err.message : err);
  } finally {
    writing = false;
    if (pending) {
      pending = false;
      persist();
    }
  }
}

function alive(key: string): Entry | undefined {
  const map = ensureLoaded();
  const e = map.get(key);
  if (!e) return undefined;
  if (e.exp && e.exp <= Date.now()) {
    map.delete(key);
    return undefined;
  }
  return e;
}

/** glob（仅支持 * 与 ?）转正则 */
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const body = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${body}$`);
}

function readJson<T>(key: string, fallback: T): T {
  const e = alive(key);
  if (!e) return fallback;
  try {
    return JSON.parse(e.v) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  ensureLoaded().set(key, { v: JSON.stringify(value) });
  persist();
}

function starOf(score: number): number {
  if (score >= 90) return 3;
  if (score >= 80) return 2;
  if (score >= 70) return 1;
  return 0;
}

interface AttemptLike {
  score: number;
  examScore?: number;
  stars?: number;
  submittedAt?: string;
  passed?: boolean;
}

interface ResultLike {
  staffName: string;
  city: string;
  subId: string;
  bestScore: number;
  stars?: number;
  learnScore?: number;
  practiceScore?: number;
  examScore?: number;
  attempts?: number;
  maxAttempts?: number;
  attemptsList?: AttemptLike[];
  firstPassBonus?: boolean;
  submittedAt: string;
  examBreakdown?: unknown;
  graded?: boolean;
  gradedAt?: string;
  gradedComment?: string | null;
  [k: string]: unknown;
}

/* ------------------------------------------------------------------ */
/* EVAL 等价实现                                                       */
/* ------------------------------------------------------------------ */

/** 考试提交：最多 2 次机会 + 两次成绩取平均（对应 submit-result 的 submitAttempt） */
function evalSubmitAttempt(keys: string[], argv: string[]): string {
  const resultsKey = keys[0];
  const staffName = argv[0];
  const subId = argv[1];
  const inc = JSON.parse(argv[2]) as ResultLike & { score: number };

  const arr = readJson<ResultLike[]>(resultsKey, []);
  let existing: ResultLike | undefined;
  const out: ResultLike[] = [];
  for (const x of arr) {
    if (x.staffName === staffName && x.subId === subId) existing = x;
    else out.push(x);
  }

  const used = existing ? (existing.attemptsList ? existing.attemptsList.length : 1) : 0;
  if (used >= 2) return JSON.stringify({ written: false, rejected: true });

  const list: AttemptLike[] = [];
  let firstBonus = false;
  if (existing) {
    if (existing.attemptsList && existing.attemptsList.length > 0) {
      list.push(...existing.attemptsList);
    } else {
      list.push({
        score: existing.bestScore || 0,
        examScore: existing.examScore ?? existing.bestScore ?? 0,
        stars: existing.stars || 0,
        submittedAt: existing.submittedAt,
        passed: (existing.bestScore || 0) >= 70,
      });
    }
    if (existing.firstPassBonus === true) firstBonus = true;
  }
  for (const a of list) {
    if (a.passed === true) firstBonus = true;
  }

  const thisPassed = inc.score >= 70;
  if (thisPassed && !firstBonus) firstBonus = true;

  list.push({
    score: inc.score,
    examScore: inc.examScore,
    stars: starOf(inc.score),
    submittedAt: inc.submittedAt,
    passed: thisPassed,
  });

  let finalScore = list[0].score;
  if (list.length === 2) {
    finalScore = Math.floor((list[0].score + list[1].score) / 2 + 0.5);
  }

  const rec: ResultLike = {
    staffName: inc.staffName,
    city: inc.city,
    subId: inc.subId,
    bestScore: finalScore,
    stars: starOf(finalScore),
    learnScore: inc.learnScore,
    practiceScore: inc.practiceScore,
    examScore: inc.examScore,
    attempts: list.length,
    maxAttempts: 2,
    attemptsList: list,
    firstPassBonus: firstBonus,
    submittedAt: inc.submittedAt,
    examBreakdown: inc.examBreakdown,
  };

  out.push(rec);
  writeJson(resultsKey, out);
  return JSON.stringify({ written: true, rejected: false, record: rec });
}

/** 成绩 upsert（replace / skip-graded / merge） */
function evalUpsert(keys: string[], argv: string[]): string {
  const resultsKey = keys[0];
  const staffName = argv[0];
  const subId = argv[1];
  const record = JSON.parse(argv[2]) as ResultLike;
  const mode = argv[3];
  const patch = (argv[4] ? JSON.parse(argv[4]) : {}) as Partial<ResultLike>;

  const arr = readJson<ResultLike[]>(resultsKey, []);
  let existing: ResultLike | undefined;
  const out: ResultLike[] = [];
  for (const x of arr) {
    if (x.staffName === staffName && x.subId === subId) existing = x;
    else out.push(x);
  }

  let toInsert: ResultLike;
  if (existing) {
    if (mode === 'skip-graded' && existing.graded === true) {
      toInsert = existing;
    } else if (mode === 'merge') {
      toInsert = { ...existing, ...patch };
    } else {
      toInsert = record;
    }
  } else {
    toInsert = record;
  }

  out.push(toInsert);
  writeJson(resultsKey, out);
  return JSON.stringify({ written: true, existing: existing ?? null });
}

/** 从成绩大 key 中精确移除某学员，返回 { keptCount, removed } */
function evalRemoveStudent(keys: string[], argv: string[]): string {
  const resultsKey = keys[0];
  const city = argv[0];
  const staffName = argv[1];

  const arr = readJson<ResultLike[]>(resultsKey, []);
  const removed: unknown[] = [];
  const kept: ResultLike[] = [];
  for (const r of arr) {
    const rc = String(r.city ?? '');
    const rn = String(r.staffName ?? '');
    if (rc === city && rn === staffName) {
      const best = Number(r.bestScore) || 0;
      removed.push({
        subId: String(r.subId ?? ''),
        bestScore: best,
        examScore: Number(r.examScore) || 0,
        passed: best >= 70,
        submittedAt: String(r.submittedAt ?? ''),
        stars: Number(r.stars) || 0,
      });
    } else {
      kept.push(r);
    }
  }
  writeJson(resultsKey, kept);
  return JSON.stringify({ keptCount: kept.length, removed });
}

/** 从录音大 key 中按 city+employee 过滤，返回移除条数 */
function evalRemoveRecordings(keys: string[], argv: string[]): number {
  const key = keys[0];
  const city = argv[0];
  const employee = argv[1];
  const arr = readJson<Record<string, unknown>[]>(key, []);
  const kept: Record<string, unknown>[] = [];
  let removed = 0;
  for (const r of arr) {
    if (String(r.city ?? '') === city && String(r.employee ?? '') === employee) removed += 1;
    else kept.push(r);
  }
  writeJson(key, kept);
  return removed;
}

/** 审计日志头插 + 只保留最近 500 条 */
function evalAppendAudit(keys: string[], argv: string[]): number {
  const key = keys[0];
  const entry = JSON.parse(argv[0]) as Record<string, unknown>;
  const arr = readJson<Record<string, unknown>[]>(key, []);
  arr.unshift(entry);
  const trimmed = arr.slice(0, 500);
  writeJson(key, trimmed);
  return trimmed.length;
}

function evalScript(script: string, keys: string[], argv: string[]): unknown {
  if (script.includes('local used = 0')) return evalSubmitAttempt(keys, argv);
  if (script.includes("mode == 'skip-graded'")) return evalUpsert(keys, argv);
  if (script.includes('keptCount')) return evalRemoveStudent(keys, argv);
  if (script.includes('removed = removed + 1')) return evalRemoveRecordings(keys, argv);
  if (script.includes('仅保留最近 500 条')) return evalAppendAudit(keys, argv);
  throw new Error('本地存储模式暂不支持该 Lua 脚本，请配置 UPSTASH_REDIS_URL/TOKEN 使用完整能力');
}

/* ------------------------------------------------------------------ */
/* 命令入口                                                            */
/* ------------------------------------------------------------------ */

export function isLocalStoreEnabled(): boolean {
  return !process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN;
}

export async function localCommand(args: string[]): Promise<unknown> {
  const cmd = String(args[0] || '').toUpperCase();
  const map = ensureLoaded();

  switch (cmd) {
    case 'GET': {
      const e = alive(args[1]);
      return e ? e.v : null;
    }
    case 'SET': {
      map.set(args[1], { v: String(args[2] ?? '') });
      persist();
      return 'OK';
    }
    case 'DEL': {
      let n = 0;
      for (const k of args.slice(1)) {
        if (map.delete(k)) n += 1;
      }
      persist();
      return n;
    }
    case 'EXISTS': {
      let n = 0;
      for (const k of args.slice(1)) {
        if (alive(k)) n += 1;
      }
      return n;
    }
    case 'EXPIRE': {
      const e = alive(args[1]);
      if (!e) return 0;
      const sec = Number(args[2]);
      e.exp = Number.isFinite(sec) && sec > 0 ? Date.now() + sec * 1000 : undefined;
      persist();
      return 1;
    }
    case 'KEYS': {
      const re = globToRegExp(args[1] || '*');
      const keys: string[] = [];
      for (const k of map.keys()) {
        if (alive(k) && re.test(k)) keys.push(k);
      }
      return keys;
    }
    case 'MGET': {
      return args.slice(1).map((k) => {
        const e = alive(k);
        return e ? e.v : null;
      });
    }
    case 'SCAN': {
      // 单进程内存库：一次性返回全部匹配 key，游标固定为 0
      let pattern = '*';
      for (let i = 1; i < args.length; i += 1) {
        if (String(args[i]).toUpperCase() === 'MATCH') pattern = String(args[i + 1] || '*');
      }
      const re = globToRegExp(pattern);
      const keys: string[] = [];
      for (const k of map.keys()) {
        if (alive(k) && re.test(k)) keys.push(k);
      }
      return ['0', keys];
    }
    case 'INCR': {
      const e = alive(args[1]);
      const next = (e ? Number(e.v) || 0 : 0) + 1;
      map.set(args[1], { v: String(next), exp: e?.exp });
      persist();
      return next;
    }
    case 'EVAL': {
      const script = String(args[1] || '');
      const numKeys = Number(args[2] || 0);
      const rest = args.slice(3);
      const keys = rest.slice(0, numKeys);
      const argv = rest.slice(numKeys);
      return evalScript(script, keys, argv);
    }
    case 'PING':
      return 'PONG';
    default:
      throw new Error(`本地存储模式不支持命令: ${cmd}`);
  }
}
