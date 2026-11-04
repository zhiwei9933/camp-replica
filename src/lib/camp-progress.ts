'use client';

import { useEffect, useState } from 'react';
import { getRank, type Rank } from './camp-data';
import { getUserInfo } from './user-info';

const PROGRESS_KEY = 'camp_progress_v1';
const SUBMISSIONS_KEY = 'camp_submissions_v1';
const STREAK_KEY = 'camp_streak_v1';

export const MAX_EXAM_ATTEMPTS = 2;

/** 单次考试明细 */
export interface AttemptRecord {
  score: number;
  examScore: number;
  stars: number;
  submittedAt: string;
  passed: boolean;
}

export interface SubLevelRecord {
  subId: string;
  /** 最终成绩（1次=该次；2次=平均分） */
  bestScore: number;
  stars: number;
  learnScore: number;
  practiceScore: number;
  /** 最近一次考核分 */
  examScore: number;
  /** 已用考试次数 */
  attempts: number;
  maxAttempts: number;
  attemptsList: AttemptRecord[];
  firstPassBonus: boolean;
  completedAt: string;
}

export interface CampProgress {
  // subId -> record
  records: Record<string, SubLevelRecord>;
  totalScore: number;
  updatedAt: string;
}

const EMPTY: CampProgress = { records: {}, totalScore: 0, updatedAt: '' };

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getCampProgress(): CampProgress {
  if (typeof window === 'undefined') return EMPTY;
  return safeParse<CampProgress>(localStorage.getItem(PROGRESS_KEY), EMPTY);
}

export function saveCampProgress(progress: CampProgress): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export function getSubLevelRecord(subId: string): SubLevelRecord | null {
  const p = getCampProgress();
  return p.records[subId] || null;
}

function normalizeRecord(r: Partial<SubLevelRecord> & { subId: string }): SubLevelRecord {
  const best = Number(r.bestScore) || 0;
  const attempts = Number(r.attempts) || 1;
  let list: AttemptRecord[] = Array.isArray(r.attemptsList) ? r.attemptsList : [];
  if (list.length === 0 && best > 0) {
    // 旧数据兼容：只有 bestScore 没有明细时补出第一次
    list = [
      {
        score: best,
        examScore: Number(r.examScore) || best,
        stars: Number(r.stars) || starFromScore(best),
        submittedAt: r.completedAt || '',
        passed: best >= 70,
      },
    ];
  }
  return {
    subId: r.subId,
    bestScore: best,
    stars: Number(r.stars) || starFromScore(best),
    learnScore: Number(r.learnScore) || 0,
    practiceScore: Number(r.practiceScore) || 0,
    examScore: Number(r.examScore) || 0,
    attempts,
    maxAttempts: Number(r.maxAttempts) || MAX_EXAM_ATTEMPTS,
    attemptsList: list,
    firstPassBonus: !!r.firstPassBonus,
    completedAt: r.completedAt || '',
  };
}

function computeFinal(list: AttemptRecord[]): number {
  if (list.length <= 1) return list[0]?.score ?? 0;
  return Math.round(list.reduce((s, a) => s + a.score, 0) / list.length);
}

/**
 * 记录一次考试成绩（新规则）：
 * - 最多 2 次机会；最终成绩=2次平均（四舍五入），1次即该次
 * - 首次通关 +10 积分奖励（重考不重复发）
 * 返回 { record, bonusGained, rejected, newRank, rankChanged }
 */
export function saveExamAttempt(input: {
  subId: string;
  score: number; // 本次总评（学+练+考，满分100/99）
  learnScore: number;
  practiceScore: number;
  examScore: number;
  examBreakdown?: import('@/lib/camp-data').ExamBreakdown | null;
}): {
  progress: CampProgress;
  record: SubLevelRecord;
  rejected: boolean;
  bonusGained: number;
  rankChanged: Rank | null;
  newRank: Rank;
} {
  const progress = getCampProgress();
  const existing = progress.records[input.subId]
    ? normalizeRecord(progress.records[input.subId])
    : null;

  if (existing && existing.attempts >= MAX_EXAM_ATTEMPTS) {
    const newRank = getRank(progress.totalScore);
    return {
      progress,
      record: existing,
      rejected: true,
      bonusGained: 0,
      rankChanged: null,
      newRank,
    };
  }

  const list: AttemptRecord[] = existing ? [...existing.attemptsList] : [];
  const thisPassed = input.score >= 70;
  let bonusGained = 0;
  const alreadyBonus = existing?.firstPassBonus || list.some((a) => a.passed);
  // 首次通关（含重考后首次达线）即发放 +10 奖励，不重复发
  if (thisPassed && !alreadyBonus) bonusGained = 10;

  list.push({
    score: Math.round(input.score),
    examScore: Math.round(input.examScore),
    stars: starFromScore(input.score),
    submittedAt: new Date().toISOString(),
    passed: thisPassed,
  });

  const finalScore = computeFinal(list);
  const record: SubLevelRecord = {
    subId: input.subId,
    bestScore: finalScore,
    stars: starFromScore(finalScore),
    learnScore: input.learnScore,
    practiceScore: input.practiceScore,
    examScore: Math.round(input.examScore),
    attempts: list.length,
    maxAttempts: MAX_EXAM_ATTEMPTS,
    attemptsList: list,
    firstPassBonus: alreadyBonus || bonusGained > 0,
    completedAt: new Date().toISOString(),
  };
  progress.records[input.subId] = record;
  progress.totalScore = recalcTotalScore(progress.records);
  progress.updatedAt = new Date().toISOString();
  saveCampProgress(progress);

  const oldRank = existing ? getRank(recalcTotalScore({ ...progress.records, [input.subId]: existing })) : null;
  const newRank = getRank(progress.totalScore);
  const rankChanged = oldRank && oldRank.key !== newRank.key ? newRank : null;

  bumpStreak();

  return { progress, record, rejected: false, bonusGained, rankChanged, newRank };
}

/** 剩余重考机会 */
export function getRemainingAttempts(subId: string): number {
  const r = getSubLevelRecord(subId);
  if (!r) return MAX_EXAM_ATTEMPTS;
  return Math.max(0, (r.maxAttempts || MAX_EXAM_ATTEMPTS) - (r.attempts || 0));
}

function recalcTotalScore(records: Record<string, SubLevelRecord>): number {
  return Object.values(records).reduce(
    (sum, r) => sum + (Number(r.bestScore) || 0) + (r.firstPassBonus ? 10 : 0),
    0,
  );
}

export function starFromScore(score: number): number {
  if (score >= 90) return 3;
  if (score >= 80) return 2;
  if (score >= 70) return 1;
  return 0;
}

export function getCompletedCount(): number {
  const p = getCampProgress();
  return Object.values(p.records).filter((r) => r.bestScore >= 70).length;
}

// === 连续学习天数 ===
export function getStreakDays(): number {
  if (typeof window === 'undefined') return 0;
  return safeParse<number>(localStorage.getItem(STREAK_KEY), 0);
}

function bumpStreak(): void {
  if (typeof window === 'undefined') return;
  const today = new Date().toISOString().split('T')[0];
  const lastKey = 'camp_last_active';
  const last = localStorage.getItem(lastKey);
  if (last === today) {
    return;
  }
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  let streak = getStreakDays();
  if (last === yesterday) {
    streak += 1;
  } else if (!last) {
    streak = 1;
  } else {
    streak = 1;
  }
  localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  localStorage.setItem(lastKey, today);
}

// 提交答题记录到后台（用于管理后台查看；排行榜由服务端根据 camp_results 聚合生成）
// staff/city 可由调用方显式传入（来自 getUserInfo），避免依赖 localStorage 中的 quiz_user_info 缺失导致静默失败。
// 返回 { ok, rejected, remainingAttempts }；rejected=true 表示服务端判定考试次数已用完
export async function submitSubLevelRecord(
  record: SubLevelRecord,
  staff?: { name?: string; project?: string } | null,
  examBreakdown?: import('@/lib/camp-data').ExamBreakdown | null,
): Promise<{ ok: boolean; rejected: boolean; remainingAttempts?: number; serverRecord?: SubLevelRecord | null }> {
  if (typeof window === 'undefined') return { ok: false, rejected: false };
  try {
    let name = staff?.name;
    let project = staff?.project;
    if (!name) {
      const raw = localStorage.getItem('quiz_user_info');
      if (raw) {
        const info = JSON.parse(raw) as { name?: string; project?: string };
        name = info.name;
        project = project || info.project;
      }
    }
    if (!name) {
      console.warn('[camp] 未找到员工姓名，成绩未上报后台。请先在首页填写姓名和城市。');
      return { ok: false, rejected: false };
    }

    const res = await fetch('/api/camp/submit-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staffName: name,
        city: project || 'unknown',
        subId: record.subId,
        score: record.bestScore === record.attemptsList?.[record.attemptsList.length - 1]?.score
          ? record.bestScore
          : record.attemptsList?.[record.attemptsList.length - 1]?.score ?? record.bestScore,
        learnScore: record.learnScore,
        practiceScore: record.practiceScore,
        examScore: record.examScore,
        completedAt: record.completedAt,
        examBreakdown: examBreakdown ?? null,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      rejected?: boolean;
      remainingAttempts?: number;
      record?: SubLevelRecord;
    };
    if (res.status === 409 || data?.rejected) {
      console.warn('[camp] 本关考试机会已用完：', data?.error);
      return { ok: false, rejected: true, remainingAttempts: 0, serverRecord: data?.record ?? null };
    }
    if (!res.ok || data?.success === false) {
      console.error('[camp] 成绩上报失败，HTTP', res.status, data?.error);
      return { ok: false, rejected: false };
    }
    return {
      ok: true,
      rejected: false,
      remainingAttempts: data?.remainingAttempts,
      serverRecord: data?.record ?? null,
    };
  } catch (e) {
    console.error('[camp] 成绩上报异常', e);
    return { ok: false, rejected: false };
  }
}

export { SUBMISSIONS_KEY };

// ========== 学习/练习阶段打点（上云，支持换电脑恢复） ==========

const STAGE_MARKS_KEY = 'camp_stage_marks_v1';
/** 重考中（未完成第2次提交）的小关 id 列表，按小关独立，用于中途退出后从断点继续 */
const RETAKING_KEY = 'camp_retaking_v1';

export interface StageMarks {
  learnDone: string[];
  practiceDone: string[];
}

const EMPTY_MARKS: StageMarks = { learnDone: [], practiceDone: [] };

export function getStageMarks(): StageMarks {
  if (typeof window === 'undefined') return EMPTY_MARKS;
  return safeParse<StageMarks>(localStorage.getItem(STAGE_MARKS_KEY), EMPTY_MARKS);
}

function saveStageMarks(marks: StageMarks): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STAGE_MARKS_KEY, JSON.stringify(marks));
}

export function isLearnDone(subId: string): boolean {
  return getStageMarks().learnDone.includes(subId);
}

export function isPracticeDone(subId: string): boolean {
  return getStageMarks().practiceDone.includes(subId);
}

/**
 * 重考时清掉本地的学/练打点，强制学员重新完成学习→练习→考试三阶段。
 * 仅清本地（云端历史打点保留，不影响换机回放逻辑；重考完成后会重新打点上报）。
 */
export function resetLocalStageMarks(subId: string): void {
  if (typeof window === 'undefined') return;
  const marks = getStageMarks();
  marks.learnDone = marks.learnDone.filter((x) => x !== subId);
  marks.practiceDone = marks.practiceDone.filter((x) => x !== subId);
  saveStageMarks(marks);
}

/** 读取重考中的小关列表 */
function getRetakingSet(): string[] {
  if (typeof window === 'undefined') return [];
  return safeParse<string[]>(localStorage.getItem(RETAKING_KEY), []);
}

function saveRetakingSet(list: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RETAKING_KEY, JSON.stringify(list));
}

/** 该小关是否处于重考中（已点重考、尚未完成第 2 次提交） */
export function isSubLevelRetaking(subId: string): boolean {
  return getRetakingSet().includes(subId);
}

/** 进入重考流程（单关维度）：仅标记该小关，其他小关成绩/星级/解锁完全不受影响 */
export function markRetaking(subId: string): void {
  const list = getRetakingSet().filter((x) => x !== subId);
  list.push(subId);
  saveRetakingSet(list);
}

/** 结束重考流程（第 2 次提交后或机会已用完时调用） */
export function clearRetaking(subId: string): void {
  if (typeof window === 'undefined') return;
  saveRetakingSet(getRetakingSet().filter((x) => x !== subId));
}

/** 记录学习/练习完成：本地 + 上报服务端（async 不阻塞，失败进队列补报） */
export function markStageDone(stage: 'learn' | 'practice', subId: string): void {  const marks = getStageMarks();
  const list = stage === 'learn' ? marks.learnDone : marks.practiceDone;
  if (list.includes(subId)) {
    // 本地已有也尝试上报（服务端可能没有，如换电脑后）
  } else {
    list.push(subId);
    saveStageMarks(marks);
  }
  void reportStageMark(stage, subId);
}

/** 上报学习/练习打点到服务端；失败进入本地队列，联网后自动补报 */
export async function reportStageMark(
  stage: 'learn' | 'practice',
  subId: string,
  staff?: { name?: string; project?: string } | null,
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const u = staff || getUserInfoLocal();
    if (!u?.name) return false;
    const res = await fetch('/api/camp/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staffName: u.name,
        city: u.project || 'unknown',
        learnDone: stage === 'learn' ? [subId] : [],
        practiceDone: stage === 'practice' ? [subId] : [],
      }),
    });
    if (!res.ok) {
      enqueuePendingStageMark(stage, subId, u);
      return false;
    }
    const data = (await res.json().catch(() => ({}))) as { success?: boolean };
    if (data?.success === false) {
      enqueuePendingStageMark(stage, subId, u);
      return false;
    }
    return true;
  } catch {
    const u = staff || getUserInfoLocal();
    if (u?.name) enqueuePendingStageMark(stage, subId, u);
    return false;
  }
}

function getUserInfoLocal(): { name?: string; project?: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('quiz_user_info');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { name?: string; project?: string };
  } catch {
    return null;
  }
}

interface PendingStageMark {
  stage: 'learn' | 'practice';
  subId: string;
  staff: { name: string; city: string };
  at: string;
}

function enqueuePendingStageMark(
  stage: 'learn' | 'practice',
  subId: string,
  staff: { name?: string; project?: string },
): void {
  if (!staff.name) return;
  try {
    const raw = localStorage.getItem('camp_pending_stage_marks') || '[]';
    const arr = JSON.parse(raw) as PendingStageMark[];
    const exists = arr.some((m) => m.stage === stage && m.subId === subId);
    if (!exists) {
      arr.push({
        stage,
        subId,
        staff: { name: staff.name, city: staff.project || 'unknown' },
        at: new Date().toISOString(),
      });
      localStorage.setItem('camp_pending_stage_marks', JSON.stringify(arr));
    }
  } catch {
    // ignore
  }
}

/** 补报所有失败的学习/练习打点（进入训练营时调用） */
export async function flushPendingStageMarks(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('camp_pending_stage_marks');
    if (!raw) return;
    const arr = JSON.parse(raw) as PendingStageMark[];
    if (!arr.length) return;
    const remain: PendingStageMark[] = [];
    for (const m of arr) {
      const ok = await reportStageMark(m.stage, m.subId, {
        name: m.staff.name,
        project: m.staff.city,
      });
      if (!ok) remain.push(m);
    }
    localStorage.setItem('camp_pending_stage_marks', JSON.stringify(remain));
  } catch {
    // ignore
  }
}

// ========== 服务端进度快照回放（换电脑恢复） ==========

export interface CloudProgress {
  staffName: string;
  city: string;
  learnDone: string[];
  practiceDone: string[];
  records: Record<string, SubLevelRecord>;
  totalScore: number;
  lastActiveAt: string | null;
}

export async function fetchCloudProgress(staff: {
  name: string;
  project: string;
}): Promise<CloudProgress | null> {
  try {
    const qs = new URLSearchParams({ city: staff.project || 'unknown', staffName: staff.name });
    const res = await fetch(`/api/camp/progress?${qs.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      learnDone?: string[];
      practiceDone?: string[];
      records?: Record<string, SubLevelRecord>;
      totalScore?: number;
      lastActiveAt?: string | null;
    };
    if (data?.success === false) return null;
    return {
      staffName: staff.name,
      city: staff.project || 'unknown',
      learnDone: Array.isArray(data.learnDone) ? data.learnDone : [],
      practiceDone: Array.isArray(data.practiceDone) ? data.practiceDone : [],
      records: data.records || {},
      totalScore: data.totalScore || 0,
      lastActiveAt: data.lastActiveAt || null,
    };
  } catch (e) {
    console.error('[camp] 拉取云端进度失败', e);
    return null;
  }
}

/**
 * 用服务端快照对本地进度做【服务端权威】对账（reconcile）：
 *
 * - 成绩记录：
 *   · 云端有的 subId：次数/明细/最终成绩以服务端为准；本地次数更多（离线刚考且在补报队列中）时保留本地
 *   · 本地有但云端没有的 subId：若在 camp_pending_reports 补报队列中（离线未上报）则保留，
 *     否则一律删除——成绩只可能由服务端产生，本地多出的只可能是服务端重置后残留的脏数据
 * - 学/练打点：以云端 learnDone/practiceDone 为基准，∪ 补报队列(camp_pending_stage_marks)中
 *   属于当前身份、尚未确认上报成功的打点；本地其余打点若云端没有一律移除（重置的关）
 * - 重考标记：云端该关无成绩记录（重置状态、剩余机会为满）时，清除本地该关 retaking 标记
 *
 * 返回是否有变化。
 */
export function applyCloudProgress(cloud: CloudProgress): boolean {
  if (typeof window === 'undefined') return false;
  let changed = false;

  const cloudRecordIds = new Set(Object.keys(cloud.records || {}));

  // 补报队列（成绩 + 打点）中属于当前身份的条目——这些是"本地有、云端可能还没有"的正当数据
  const pendingReportSubs = readPendingReportSubIds(cloud.staffName, cloud.city);
  const pendingLearn = new Set<string>();
  const pendingPractice = new Set<string>();
  for (const m of readPendingStageMarks(cloud.staffName, cloud.city)) {
    if (m.stage === 'learn') pendingLearn.add(m.subId);
    else pendingPractice.add(m.subId);
  }

  // 1) 成绩记录对账
  const progress = getCampProgress();
  const nextRecords: Record<string, SubLevelRecord> = {};
  for (const [subId, crRaw] of Object.entries(cloud.records || {})) {
    if (!crRaw) continue;
    const cloudRec = normalizeRecord({ ...crRaw, subId });
    const local = progress.records[subId];
    if (!local) {
      nextRecords[subId] = cloudRec;
      changed = true;
    } else {
      const localRec = normalizeRecord(local);
      // 云端次数 >= 本地：服务端权威；本地次数更多（离线刚考、补报队列中）：保留本地
      const keepLocal = localRec.attempts > cloudRec.attempts && pendingReportSubs.has(subId);
      const merged = keepLocal ? localRec : cloudRec;
      nextRecords[subId] = merged;
      if (JSON.stringify(merged) !== JSON.stringify(localRec)) changed = true;
    }
  }
  // 本地有、云端没有：补报队列中的离线成绩保留，其余删除
  for (const [subId, localRaw] of Object.entries(progress.records || {})) {
    if (cloudRecordIds.has(subId)) continue;
    if (pendingReportSubs.has(subId)) {
      nextRecords[subId] = normalizeRecord(localRaw);
    } else {
      changed = true; // 服务端已重置/删除的残留成绩
    }
  }
  progress.records = nextRecords;
  progress.totalScore = recalcTotalScore(nextRecords);
  progress.updatedAt = new Date().toISOString();
  saveCampProgress(progress);

  // 2) 学/练打点对账：云端 ∪ 待补报打点；其余本地打点移除
  const reconcileMarks = (cloudList: string[], pending: Set<string>): string[] => {
    const out = new Set<string>(cloudList);
    for (const id of pending) out.add(id);
    return [...out];
  };
  const marks = getStageMarks();
  const nextLearn = reconcileMarks(cloud.learnDone || [], pendingLearn);
  const nextPractice = reconcileMarks(cloud.practiceDone || [], pendingPractice);
  if (
    JSON.stringify([...marks.learnDone].sort()) !== JSON.stringify([...nextLearn].sort()) ||
    JSON.stringify([...marks.practiceDone].sort()) !== JSON.stringify([...nextPractice].sort())
  ) {
    changed = true;
  }
  marks.learnDone = nextLearn;
  marks.practiceDone = nextPractice;
  saveStageMarks(marks);

  // 3) 重考标记对账：云端无该关成绩（已重置）→ 清除本地重考标记
  const retakingList = getRetakingSet();
  const nextRetaking = retakingList.filter((subId) => cloudRecordIds.has(subId));
  if (nextRetaking.length !== retakingList.length) {
    saveRetakingSet(nextRetaking);
    changed = true;
  }

  return changed;
}

/** 读取成绩补报队列中属于指定身份的 subId 集合 */
function readPendingReportSubIds(staffName: string, city: string): Set<string> {
  const set = new Set<string>();
  if (typeof window === 'undefined') return set;
  try {
    const arr = safeParse<
      Array<{
        record?: { subId?: string };
        staff?: { name?: string; city?: string } | null;
      }>
    >(localStorage.getItem('camp_pending_reports'), []);
    for (const item of arr) {
      const s = item.staff;
      if (s && s.name !== staffName) continue;
      if (s && s.city && s.city !== city) continue;
      if (item.record?.subId) set.add(item.record.subId);
    }
  } catch {
    // ignore
  }
  return set;
}

/** 读取学/练打点补报队列中属于指定身份的条目 */
function readPendingStageMarks(staffName: string, city: string): PendingStageMark[] {
  if (typeof window === 'undefined') return [];
  try {
    const arr = safeParse<PendingStageMark[]>(localStorage.getItem('camp_pending_stage_marks'), []);
    return arr.filter((m) => m.staff?.name === staffName && (m.staff?.city || 'unknown') === city);
  } catch {
    return [];
  }
}

/**
 * 切换账号/退出：清空本地训练营身份相关数据（成绩、打点、队列、连胜）。
 * 成绩已上云，清空不影响服务端数据；用同一姓名+城市重新进入会自动回放。
 */
export function clearLocalCampIdentity(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PROGRESS_KEY);
  localStorage.removeItem(STAGE_MARKS_KEY);
  localStorage.removeItem(RETAKING_KEY);
  localStorage.removeItem(STREAK_KEY);
  localStorage.removeItem('camp_last_active');
  localStorage.removeItem('camp_pending_reports');
  localStorage.removeItem('camp_pending_stage_marks');
  // 清理各小关补考次数
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('camp_sub_') || k.startsWith('camp_exam_attempts_'))) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

export interface CampSyncState {
  synced: boolean; // 云端快照已回放完成（或无身份跳过）
  changed: boolean; // 本次回放是否带来了本地变化
}

/**
 * 进入训练营各页面时调用：
 * 1. 有身份 → 拉取云端进度快照回放本地 → 补报失败队列
 * 2. 无身份 → 直接结束（等待用户填写身份）
 * 返回 synced，页面可据此在同步完成后再渲染依赖进度的 UI。
 */
export function useCampSync(): CampSyncState {
  const [state, setState] = useState<CampSyncState>({ synced: false, changed: false });
  useEffect(() => {
    let cancelled = false;
    const user = getUserInfo();
    if (!user?.name || !user.project) {
      setState({ synced: true, changed: false });
      return;
    }
    (async () => {
      const cloud = await fetchCloudProgress({ name: user.name, project: user.project });
      let changed = false;
      if (cloud) changed = applyCloudProgress(cloud);
      await flushPendingStageMarks();
      if (!cancelled) setState({ synced: true, changed });
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
