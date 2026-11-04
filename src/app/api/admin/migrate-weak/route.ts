import { NextRequest, NextResponse } from 'next/server';
import { readAllResults } from '../../camp/submit-result/route';
import {
  appendWeakEntries,
  buildWeakEntriesFromBreakdown,
  listWeakKeys,
  CAMP_WEAK_PREFIX,
  type WeakEntry,
} from '@/lib/camp-weak';
import { upstashCommand } from '@/lib/upstash';

/**
 * 一次性生产迁移接口：从生产库 camp_results 重算历史非满分题，按人写入 camp_weak:*。
 *
 * 安全保护：固定 token（header `x-migrate-token` 或 `authorization: Bearer <token>`）。
 * token 取 env `CAMP_WEAK_MIGRATE_TOKEN`，未配置时使用代码内默认常量（见 MIGRATE_TOKEN）。
 *
 * - POST            正式迁移（或 body {"dryRun":true} 只统计）
 * - GET             只读诊断：返回 SCAN camp_weak:* 的 key 列表（原始字符串 + 每 key 条目数）
 *
 * 幂等：appendWeakEntries 按条目 id 去重，可重复执行不产生重复条目。
 * 只读 camp_results；迁移前把 camp_results 快照备份到 camp_results_backup_weak_migration（TTL=-1，覆盖写）。
 */
const MIGRATE_TOKEN = 'camp-weak-migrate-2026-9f3a';
const BACKUP_KEY = 'camp_results_backup_weak_migration';

function getToken(): string {
  return process.env.CAMP_WEAK_MIGRATE_TOKEN || MIGRATE_TOKEN;
}

function isAuthorized(request: NextRequest): boolean {
  const headerToken =
    request.headers.get('x-migrate-token') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  return headerToken === getToken();
}

/** 只读诊断：SCAN camp_weak:* 原始 key + 每 key 条目数（token 保护） */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city') || '';

    // 原始 SCAN（带城市过滤）
    const keys = await listWeakKeys(city ? { city } : undefined);

    // 同时给一份不带任何过滤、用 KEYS 兜底的对比，便于发现 MATCH/编码不一致
    const rawKeysAll = (await upstashCommand(['KEYS', `${CAMP_WEAK_PREFIX}*`])) as string[];
    // 排查是否存在「前缀被编码」的脏 key（如 camp_weak%3A... 或含 % 的疑似误写 key）
    const suspiciousKeys = (await upstashCommand(['KEYS', '*camp_weak*'])) as string[];
    const encodedLike = suspiciousKeys.filter(
      (k) => typeof k === 'string' && (!k.startsWith(CAMP_WEAK_PREFIX) || k.includes('%')),
    );

    const detail: Array<{ key: string; entries: number; bytes: number }> = [];
    let totalEntries = 0;
    for (const k of keys) {
      const raw = (await upstashCommand(['GET', k])) as string | null;
      let entries = 0;
      if (typeof raw === 'string' && raw) {
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) entries = arr.length;
        } catch {
          entries = -1; // 解析失败标记
        }
      }
      totalEntries += entries > 0 ? entries : 0;
      detail.push({ key: k, entries, bytes: raw ? Buffer.byteLength(raw, 'utf8') : 0 });
    }

    return NextResponse.json({
      success: true,
      filterCity: city || null,
      scannedWeakKeys: keys.length,
      scannedWeakEntries: totalEntries,
      keysCampWeakPrefix: Array.isArray(rawKeysAll) ? rawKeysAll.length : 0,
      keysContainingCampWeak: Array.isArray(suspiciousKeys) ? suspiciousKeys.length : 0,
      encodedLikeKeys: encodedLike,
      keys: detail,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const body = (request.headers.get('content-length')
      ? await request.json().catch(() => ({}))
      : {}) as { dryRun?: boolean };
    const dryRun = body.dryRun === true;

    // 1. 读取生产库 camp_results 全量
    const results = await readAllResults();

    // 2. 备份 camp_results（覆盖写，永久保留）—— 仅在真实迁移时备份
    let backupBytes = 0;
    if (!dryRun) {
      const payload = JSON.stringify({ backedUpAt: new Date().toISOString(), results });
      await upstashCommand(['SET', BACKUP_KEY, payload]);
      backupBytes = Buffer.byteLength(payload, 'utf8');
    }

    // 3. 按人聚合本次重算的薄弱条目
    const perPerson = new Map<string, { city: string; staffName: string; entries: WeakEntry[] }>();
    let recordsWithBreakdown = 0;
    let objectiveCount = 0;
    let textCount = 0;

    for (const r of results) {
      if (!r || !r.staffName || !r.city || !r.subId || !r.submittedAt) continue;
      const bd = r.examBreakdown;
      if (bd) recordsWithBreakdown += 1;
      const entries = buildWeakEntriesFromBreakdown({
        staffName: r.staffName,
        city: r.city,
        subId: r.subId,
        submittedAt: r.submittedAt,
        examBreakdown: bd,
      });
      if (entries.length === 0) continue;
      const key = `${r.city}::${r.staffName}`;
      const bucket = perPerson.get(key) || { city: r.city, staffName: r.staffName, entries: [] };
      for (const e of entries) {
        bucket.entries.push(e);
        if (e.qType === 'text') textCount += 1;
        else objectiveCount += 1;
      }
      perPerson.set(key, bucket);
    }

    const recomputedEntries = objectiveCount + textCount;

    if (dryRun) {
      // dry-run 也回读一次当前存量，便于判断「写入后能否读回」
      const existingKeys = await listWeakKeys();
      let existingEntries = 0;
      for (const k of existingKeys) {
        const raw = (await upstashCommand(['GET', k])) as string | null;
        if (typeof raw === 'string' && raw) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) existingEntries += arr.length;
          } catch {
            // ignore
          }
        }
      }
      return NextResponse.json({
        success: true,
        dryRun: true,
        totalResults: results.length,
        recordsWithBreakdown,
        personsToWrite: perPerson.size,
        recomputedEntries,
        objectiveCount,
        textCount,
        scannedWeakKeys: existingKeys.length,
        scannedWeakEntries: existingEntries,
      });
    }

    // 4. 按人写入（appendWeakEntries = 读旧数组 + 按 id 去重合并 + SET 回写，无 TTL）
    let keysWritten = 0;
    for (const bucket of perPerson.values()) {
      await appendWeakEntries(bucket.city, bucket.staffName, bucket.entries);
      keysWritten += 1;
    }

    // 4.5 安全清理「前缀被编码/误写」的脏 key：仅删除含 camp_weak 但不满足 camp_weak:{city}:{name} 的 key。
    //     绝不触碰 camp_results / camp_progress:* / 备份 key。
    const containingWeak = ((await upstashCommand(['KEYS', '*camp_weak*'])) as string[] | null) || [];
    const dirtyKeys = containingWeak.filter(
      (k) => typeof k === 'string' && k !== BACKUP_KEY && !k.startsWith(CAMP_WEAK_PREFIX),
    );
    const cleanedDirtyKeys: string[] = [];
    for (const dk of dirtyKeys) {
      // 双保险：只删看起来确实是薄弱派生数据的误写 key（名字里带 camp_weak），其余一律不动
      if (/camp[_-]?weak/i.test(dk)) {
        await upstashCommand(['DEL', dk]);
        cleanedDirtyKeys.push(dk);
      }
    }

    // 5. 自检：迁移完成后立即 SCAN 回读，确认读写闭环
    const scannedKeys = await listWeakKeys();
    let scannedEntries = 0;
    for (const k of scannedKeys) {
      const raw = (await upstashCommand(['GET', k])) as string | null;
      let n = 0;
      if (typeof raw === 'string' && raw) {
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) n = arr.length;
        } catch {
          n = -1;
        }
      }
      if (n > 0) scannedEntries += n;
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      totalResults: results.length,
      recordsWithBreakdown,
      personsToWrite: perPerson.size,
      keysWritten,
      recomputedEntries,
      objectiveCount,
      textCount,
      scannedWeakKeys: scannedKeys.length,
      scannedWeakEntries: scannedEntries,
      cleanedDirtyKeys,
      backupKey: BACKUP_KEY,
      backupBytes,
      note: 'camp_results 未被修改；camp_weak:* 为派生数据，可随时重跑本接口（幂等）',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
