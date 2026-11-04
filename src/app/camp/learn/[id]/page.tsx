'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Trophy,
  ArrowRight,
  ArrowLeft,
  GripVertical,
} from 'lucide-react';
import {
  LEVELS,
  flattenSubLevels,
  type ExamBreakdown,
  type ExamQuestion,
  type PracticeQuestion,
  type SubLevel,
} from '@/lib/camp-data';
import {
  saveExamAttempt,
  submitSubLevelRecord,
  markStageDone,
  resetLocalStageMarks,
  markRetaking,
  clearRetaking,
  isSubLevelRetaking,
  isLearnDone,
  isPracticeDone,
  getSubLevelRecord,
  getRemainingAttempts,
  MAX_EXAM_ATTEMPTS,
  useCampSync,
  type SubLevelRecord,
} from '@/lib/camp-progress';
import { getUserInfo } from '@/lib/user-info';
import { cn } from '@/lib/utils';
import { gradeExam } from '@/lib/camp-text-scoring';
import { FinalExam } from './final-exam';
import { FINAL_EXAM_INFO } from '@/lib/camp/chapter8';

type Stage = 'learn' | 'practice' | 'exam' | 'result';

interface StageResult {
  learn: number;
  practice: number;
  exam: number;
  total: number;
  passed: boolean;
  stars: number;
  bonusGained: number;
  rankUp: { icon: string; name: string } | null;
  attempts: number;
  attemptOneScore?: number;
  attemptTwoScore?: number;
}

export default function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [subId, setSubId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('learn');
  const [result, setResult] = useState<StageResult | null>(null);

  // 练习与考试状态
  const [learnIdx, setLearnIdx] = useState(0);
  const [learnDone, setLearnDone] = useState(false);
  const [practiceScore, setPracticeScore] = useState(0);
  const [practiceDone, setPracticeDone] = useState(false);
  const [examAnswers, setExamAnswers] = useState<Record<string, number>>({});
  const [examTextAnswers, setExamTextAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [examScore, setExamScore] = useState(0);

  // 进入页面先从云端回放进度（换电脑恢复），回放完成后再按历史状态定位阶段
  const { synced } = useCampSync();
  // 重考流程（单关维度）：持久化到 localStorage，中途退出再进从断点继续；提交第 2 次后解除
  const [retaking, setRetakingState] = useState(false);

  useEffect(() => {
    params.then((p) => {
      setSubId(p.id);
      setRetakingState(isSubLevelRetaking(p.id));
    });
  }, [params]);

  function handleRetake() {
    if (!subId) return;
    markRetaking(subId); // 持久化标记，仅本关
    setRetakingState(true);
  }

  const allSubs = useMemo(() => flattenSubLevels(), []);
  const ctx = useMemo(() => {
    if (!subId) return null;
    return allSubs.find((x) => x.sub.id === subId) || null;
  }, [subId, allSubs]);

  const sub: SubLevel | null = ctx?.sub || null;
  const level = ctx?.level;

  // 切换小关 / 云端回放完成后：已通关的直接看结果，已完成学/练的从对应阶段继续
  useEffect(() => {
    if (!subId || !synced) return;
    setLearnIdx(0);
    setExamAnswers({});
    setExamTextAnswers({});
    setExamScore(0);
    setSubmitError(null);
    setSubmitting(false);
    setResult(null);

    const rec = getSubLevelRecord(subId);
    const usedAttempts = rec?.attempts || 0;
    const hasResult = usedAttempts > 0;
    const finalScore = rec?.bestScore || 0;
    const passed = hasResult && finalScore >= 70;

    // 重考流程（单关维度）：点击重考后仅重置本关，中途退出再进从断点继续
    if (retaking) {
      if (usedAttempts >= MAX_EXAM_ATTEMPTS) {
        // 重考已完成（第2次已提交）或换机后次数已达上限：解除重考态，展示最终成绩
        clearRetaking(subId);
        setRetakingState(false);
        // 落入下面的 hasResult 结果页逻辑
      } else {
        // 重考进行中：学/练打点决定断点位置（首次点击重考时先清掉旧打点）
        if (!isLearnDone(subId) && !isPracticeDone(subId)) {
          resetLocalStageMarks(subId);
        }
        const learned = isLearnDone(subId);
        const practiced = isPracticeDone(subId);
        setLearnDone(learned);
        setPracticeDone(practiced);
        setPracticeScore(practiced ? 30 : 0);
        if (!learned) setStage('learn');
        else if (!practiced && subId !== '8-1') setStage('practice');
        else setStage('exam');
        return;
      }
    }

    if (hasResult) {
      // 有历史成绩：展示最终成绩，可点"重考本关"（仅在还有考试机会时）
      const attList = rec?.attemptsList || [];
      setLearnDone(true);
      setPracticeDone(true);
      setPracticeScore(rec?.practiceScore || 0);
      setStage('result');
      setResult({
        learn: rec?.learnScore || 0,
        practice: rec?.practiceScore || 0,
        exam: rec?.examScore || 0,
        total: finalScore,
        passed,
        stars: rec?.stars || 0,
        bonusGained: 0,
        rankUp: null,
        attempts: usedAttempts,
        attemptOneScore: attList[0]?.score,
        attemptTwoScore: attList[1]?.score,
      });
      return;
    }
    const learned = isLearnDone(subId);
    const practiced = isPracticeDone(subId);
    setLearnDone(learned);
    setPracticeDone(practiced);
    setPracticeScore(practiced ? 30 : 0);
    if (!learned) setStage('learn');
    else if (!practiced && subId !== '8-1') setStage('practice');
    else setStage('exam');
  }, [subId, synced, retaking]);

  if (!subId || !sub || !level) {
    return <div className="min-h-screen bg-[#F5F7FC]" />;
  }

  // 云端进度回放中：先占位，避免换电脑进入瞬间显示未解锁/从头学
  if (!synced) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center p-4">
        <div className="text-center text-slate-400 text-sm">
          <div className="text-3xl mb-2 animate-pulse">⏳</div>
          正在恢复你的学习进度…
        </div>
      </div>
    );
  }

  // 第8章结业考核特殊处理：有 learnCards，没有 practice/exam
  const isFinalExam = sub.id === '8-1';

  // 内容未开放的小关
  if (
    sub.status !== 'available' ||
    !sub.learnCards ||
    (!isFinalExam && (!sub.practice || !sub.exam))
  ) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm text-center shadow-lg">
          <div className="text-5xl mb-3">🚧</div>
          <h2 className="text-lg font-bold mb-2">内容筹备中</h2>
          <p className="text-sm text-slate-500 mb-4">
            小关 <b>{sub.id}</b>「{sub.title}」正在紧锣密鼓地准备中，先完成第1-1关体验完整流程吧！
          </p>
          <Link
            href="/camp/learn/1-1"
            className="inline-flex items-center gap-1 text-sm px-4 py-2 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg,#4F6BED,#7B61FF)' }}
          >
            前往 1-1 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // content is guaranteed available from here on
  const subAvail = sub as SubLevel & {
    learnCards: NonNullable<SubLevel['learnCards']>;
    practice: SubLevel['practice'];
    exam: SubLevel['exam'];
  };
  const levelAvail = level!;

  const practiceMax = subAvail.practice?.reduce((s, q) => s + q.score, 0) ?? 0;
  const examMax = 50; // 考核满分 50 分（学20 + 练30 + 考50 = 100）

  function finishLearn() {
    setLearnDone(true);
    markStageDone('learn', subAvail.id); // 打点上云，换电脑可恢复学习完成状态
    if (isFinalExam) {
      setStage('exam'); // 结业考核：学完直接进入考试
    } else {
      setStage('practice');
    }
  }

  function finishPractice(score: number) {
    setPracticeScore(score);
    setPracticeDone(true);
    markStageDone('practice', subAvail.id); // 打点上云
    setStage('exam');
  }

  async function submitExam() {
    const examList = subAvail.exam ?? [];
    // 未作答客观题/简答题统计：提示但不强制阻止（简答题 0 分也允许提交）
    const unansweredObjective = examList.filter(
      (q) => (q.type === 'single' || q.type === 'judge') && examAnswers[q.id] === undefined,
    );
    if (unansweredObjective.length > 0) {
      const ok = window.confirm(
        `你还有 ${unansweredObjective.length} 道客观题未作答，未作答将按 0 分计。确定要提交吗？`,
      );
      if (!ok) return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      // 自动评分：客观题 + 简答题按得分点命中率给分
      const { examRaw, objectiveCorrect, objectiveTotal, perQ, objectiveScores, textScores } =
        gradeExam(examList, examAnswers, examTextAnswers, examMax);
      const examRounded = Math.round(examRaw);
      setExamScore(examRounded);

      const textQuestionIds = examList
        .filter((q): q is Extract<ExamQuestion, { type: 'text' }> => q.type === 'text')
        .map((q) => q.id);

      // 考核成绩明细：简答题答案和得分点命中情况一并保存，便于后台复核与手动调分
      const examBreakdown: ExamBreakdown = {
        kind: 'standard',
        objectiveCorrect,
        objectiveTotal,
        objectivePerPoint: perQ,
        objectiveScores,
        textQuestionIds,
        textPerPoint: perQ,
        textScores,
        examMax,
      };

      const reportOk = await finalizeLevel(examRounded, examBreakdown);
      if (!reportOk) {
        setSubmitError(
          '成绩已保存在本机，但上传到排行榜失败。请检查网络后点击下方"重新上报"按钮。',
        );
      }
    } catch (e) {
      console.error('[camp] 提交考核失败', e);
      setSubmitError(
        e instanceof Error ? `提交失败：${e.message}，请重试` : '提交失败，请重试',
      );
    } finally {
      setSubmitting(false);
    }
  }

  // 结算小关成绩：2次机会+平均分规则。返回 true 表示上报成功/本地已保存。
  async function finalizeLevel(examSc: number, breakdown: ExamBreakdown): Promise<boolean> {
    const rawTotal = 20 + practiceScore + examSc;
    const saved = saveExamAttempt({
      subId: subAvail.id,
      score: rawTotal,
      learnScore: 20,
      practiceScore,
      examScore: examSc,
      examBreakdown: breakdown,
    });
    const rec = saved.record;
    clearRetaking(subAvail.id); // 本次提交即本次机会完成：无论是否被服务端拒绝，重考流程都已结束
    setRetakingState(false);

    let reportOk = false;
    const u = getUserInfo();
    const res = await submitSubLevelRecord(rec, u ?? undefined, breakdown);
    if (res.rejected && res.serverRecord) {
      // 服务端判定次数用完：以服务端记录为准回放本地
      applyServerRecord(res.serverRecord);
      reportOk = true;
    } else if (res.ok) {
      reportOk = true;
      if (res.serverRecord) applyServerRecord(res.serverRecord);
    } else {
      enqueuePendingReport(rec, breakdown);
      console.error('[camp] 成绩上报失败（已暂存，可在结果页重试）', { subId: subAvail.id });
    }

    const finalRec = getSubLevelRecord(subAvail.id) || rec;
    setExamScore(examSc);
    setResult({
      learn: 20,
      practice: practiceScore,
      exam: examSc,
      total: finalRec.bestScore,
      passed: finalRec.bestScore >= 70,
      stars: finalRec.stars,
      bonusGained: saved.bonusGained,
      rankUp: saved.rankChanged && saved.newRank ? { icon: saved.newRank.icon, name: saved.newRank.name } : null,
      attempts: finalRec.attempts,
      attemptOneScore: finalRec.attemptsList?.[0]?.score,
      attemptTwoScore: finalRec.attemptsList?.[1]?.score,
    });
    setStage('result');
    return reportOk;
  }

  /** 用服务端返回的最终记录覆盖本地（处理换机/409冲突场景） */
  function applyServerRecord(server: SubLevelRecord) {
    try {
      const p = (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('camp_progress_v1') || '{}') : {}) as {
        records?: Record<string, SubLevelRecord>;
        totalScore?: number;
        updatedAt?: string;
      };
      const nextRecords = { ...(p.records || {}), [server.subId]: server };
      const totalScore = Object.values(nextRecords).reduce(
        (s, r) => s + (r.bestScore || 0) + (r.firstPassBonus ? 10 : 0),
        0,
      );
      localStorage.setItem(
        'camp_progress_v1',
        JSON.stringify({ records: nextRecords, totalScore, updatedAt: new Date().toISOString() }),
      );
    } catch (e) {
      console.error('[camp] 应用服务端记录失败', e);
    }
  }

  // 上报失败的成绩暂存到 localStorage，供结果页重试
  function enqueuePendingReport(rec: SubLevelRecord, breakdown: ExamBreakdown) {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('camp_pending_reports') || '[]';
      const arr: unknown[] = JSON.parse(raw);
      const u = getUserInfo();
      arr.push({
        record: rec,
        staff: u ? { name: u.name, city: u.project } : null,
        breakdown,
        at: new Date().toISOString(),
      });
      localStorage.setItem('camp_pending_reports', JSON.stringify(arr));
    } catch (e) {
      console.error('[camp] 暂存待上报成绩失败', e);
    }
  }

  // 结果页"重新上报"按钮：把所有暂存的失败成绩重新提交
  async function retryPendingReports() {
    if (typeof window === 'undefined') return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const raw = localStorage.getItem('camp_pending_reports') || '[]';
      const arr: Array<{
        record: SubLevelRecord;
        staff?: { name: string; city: string } | null;
        breakdown?: ExamBreakdown | null;
      }> = JSON.parse(raw);
      const remain: typeof arr = [];
      for (const item of arr) {
        const staff = item.staff
          ? { name: item.staff.name, project: item.staff.city }
          : getUserInfo() ?? undefined;
        const r = await submitSubLevelRecord(
          item.record,
          staff,
          item.breakdown ?? undefined,
        );
        if (!r.ok) remain.push(item);
      }
      localStorage.setItem('camp_pending_reports', JSON.stringify(remain));
      if (remain.length === 0) {
        setSubmitError(null);
      } else {
        setSubmitError(`仍有 ${remain.length} 条成绩上报失败，请稍后再试`);
      }
    } catch (e) {
      console.error('[camp] 重试上报失败', e);
      setSubmitError('重试失败，请检查网络后再试');
    } finally {
      setSubmitting(false);
    }
  }

  async function finishFinalExam(r: {
    score: number;
    totalScore: number;
    passed: boolean;
    judgeCorrect: number;
    judgeTotal: number;
    textQuestionIds: string[];
    textScores: import('@/lib/camp-data').TextQuestionScore[];
    objectiveScores: import('@/lib/camp-data').ObjectiveQuestionScore[];
  }) {
    const finalBreakdown: ExamBreakdown = {
      kind: 'final',
      objectiveCorrect: r.judgeCorrect,
      objectiveTotal: r.judgeTotal,
      objectivePerPoint: FINAL_EXAM_INFO.judgeScore,
      objectiveScores: r.objectiveScores,
      textQuestionIds: r.textQuestionIds,
      textPerPoint: FINAL_EXAM_INFO.oralScore,
      textScores: r.textScores,
      examMax: FINAL_EXAM_INFO.totalScore,
    };

    const saved = saveExamAttempt({
      subId: subAvail.id,
      score: r.score,
      learnScore: 0,
      practiceScore: 0,
      examScore: r.score,
      examBreakdown: finalBreakdown,
    });
    const rec = saved.record;
    clearRetaking(subAvail.id);
    setRetakingState(false);

    setResult({
      learn: 0,
      practice: 0,
      exam: r.score,
      total: rec.bestScore,
      passed: rec.bestScore >= FINAL_EXAM_INFO.passScore,
      stars: rec.stars,
      bonusGained: saved.bonusGained,
      rankUp: saved.rankChanged && saved.newRank ? { icon: saved.newRank.icon, name: saved.newRank.name } : null,
      attempts: rec.attempts,
      attemptOneScore: rec.attemptsList?.[0]?.score,
      attemptTwoScore: rec.attemptsList?.[1]?.score,
    });
    setStage('result');
    setSubmitting(true);
    setSubmitError(null);
    try {
      const u = getUserInfo();
      const res = await submitSubLevelRecord(rec, u ?? undefined, finalBreakdown);
      if (res.rejected && res.serverRecord) {
        applyServerRecord(res.serverRecord);
      } else if (!res.ok) {
        enqueuePendingReport(rec, finalBreakdown);
        setSubmitError(
          '结业成绩已保存在本机，但上传排行榜失败。请检查网络后点击下方“重新上报”按钮。',
        );
      } else if (res.serverRecord) {
        applyServerRecord(res.serverRecord);
      }
    } catch (e) {
      console.error('[camp] 结业成绩上报异常', e);
      enqueuePendingReport(rec, finalBreakdown);
      setSubmitError('成绩上传发生异常，请点击“重新上报”重试。');
    } finally {
      setSubmitting(false);
    }
  }

  // 找下一个小关
  const nextSub = (() => {
    const idx = allSubs.findIndex((x) => x.sub.id === subAvail.id);
    const nxt = allSubs[idx + 1];
    if (nxt && nxt.sub.status === 'available') return nxt;
    return null;
  })();

  return (
    <div className="min-h-screen bg-[#F5F7FC]">
      {/* 顶部进度条 */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-4">
          <Link
            href={`/camp/level/${levelAvail.id}`}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-[#4F6BED] flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回</span>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-700 truncate">
              {levelAvail.icon} {subAvail.id} · {subAvail.title}
            </div>
          </div>
          {stage !== 'result' && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
              约 {subAvail.duration} 分钟
            </div>
          )}
        </div>
        {stage !== 'result' && (
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 pb-3">
            {isFinalExam ? (
              <div className="flex items-center gap-2 text-xs">
                <StageStep label="说明" active={stage === 'learn'} done={learnDone} score={0} />
                <div className="flex-1 h-px bg-slate-200" />
                <StageStep label="统考" active={stage === 'exam'} done={false} score={99} />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <StageStep label="学" active={stage === 'learn'} done={learnDone} score={20} />
                <div className="flex-1 h-px bg-slate-200" />
                <StageStep label="练" active={stage === 'practice'} done={practiceDone} score={30} />
                <div className="flex-1 h-px bg-slate-200" />
                <StageStep label="考" active={stage === 'exam'} done={!!result} score={50} />
              </div>
            )}
          </div>
        )}
      </header>

      <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {retaking && stage !== 'result' && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800">
            🔁 <b>重考中：</b>本关为重考流程，需重新完成学习→练习→考试；仅影响 <b>{subAvail.id}</b> 本关成绩，其他小关不受影响。最终成绩 = 两次考试平均分。
          </div>
        )}
        {stage === 'learn' && (
          <LearnStage
            cards={subAvail.learnCards}
            index={learnIdx}
            onNext={() => {
              if (learnIdx < subAvail.learnCards.length - 1) setLearnIdx(learnIdx + 1);
              else finishLearn();
            }}
            onPrev={() => {
              if (learnIdx > 0) setLearnIdx(learnIdx - 1);
            }}
            finalExam={isFinalExam}
          />
        )}
        {stage === 'practice' && !isFinalExam && subAvail.practice && (
          <PracticeStage
            questions={subAvail.practice}
            maxScore={practiceMax}
            onDone={finishPractice}
          />
        )}
        {stage === 'exam' && isFinalExam && (
          <FinalExam
            onFinish={(r) => {
              finishFinalExam({
                score: r.score,
                totalScore: r.totalScore,
                passed: r.passed,
                judgeCorrect: r.judgeCorrect,
                judgeTotal: r.judgeTotal,
                textQuestionIds: r.textQuestionIds,
                textScores: r.textScores,
                objectiveScores: r.objectiveScores,
              });
            }}
          />
        )}
        {stage === 'exam' && !isFinalExam && subAvail.exam && (
          <ExamStage
            questions={subAvail.exam}
            maxScore={examMax}
            answers={examAnswers}
            textAnswers={examTextAnswers}
            submitting={submitting}
            onAnswer={(qid, optIdx) => setExamAnswers({ ...examAnswers, [qid]: optIdx })}
            onTextAnswer={(qid, val) => setExamTextAnswers((prev) => ({ ...prev, [qid]: val }))}
            onSubmit={submitExam}
          />
        )}
        {stage === 'result' && result && (
          <ResultStage
            result={result}
            subTitle={subAvail.title}
            subId={subAvail.id}
            levelId={levelAvail.id}
            nextSub={nextSub ? { id: nextSub.sub.id, title: nextSub.sub.title } : null}
            onHome={() => router.push('/camp')}
            submitError={submitError}
            submitting={submitting}
            onRetry={retryPendingReports}
            onRetake={handleRetake}
            remainingAttempts={getRemainingAttempts(subAvail.id)}
            isFinalExam={isFinalExam}
          />
        )}
      </main>
    </div>
  );
}

function StageStep({
  label,
  active,
  done,
  score,
}: {
  label: string;
  active: boolean;
  done: boolean;
  score: number;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-all',
        active ? 'bg-[#4F6BED] text-white' : done ? 'bg-[#E6F9F1] text-[#00B578]' : 'text-slate-400',
      )}
    >
      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{label}</span>}
      <span className={cn('text-[11px]', active ? 'text-white/80' : done ? 'text-[#00B578]/70' : 'text-slate-300')}>
        {score}分
      </span>
    </div>
  );
}

// ========== 学 ==========
function LearnStage({
  cards,
  index,
  onNext,
  onPrev,
  finalExam,
}: {
  cards: NonNullable<SubLevel['learnCards']>;
  index: number;
  onNext: () => void;
  onPrev?: () => void;
  finalExam?: boolean;
}) {
  const card = cards[index];
  const isLast = index === cards.length - 1;
  const hasBlocks = !!card.blocks && card.blocks.length > 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-xs text-[#4F6BED] font-medium">
            {finalExam ? '🏆 考核说明' : '📖 秘籍阅读'} · 第 {index + 1}/{cards.length} 页
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mt-1">{card.title}</h2>
          {card.lead && <p className="text-sm text-slate-500 mt-1">{card.lead}</p>}
        </div>
        {!finalExam && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
            学完即得 20 分
          </div>
        )}
      </div>
      <div
        key={index}
        className="bg-white rounded-2xl p-5 sm:p-8 shadow-[0_4px_20px_rgba(79,107,237,0.06)] border border-slate-100"
        style={{ animation: 'fadeIn 0.3s ease' }}
      >
        {hasBlocks ? (
          <div className="space-y-4">
            {card.blocks!.map((b, i) => (
              <LearnBlockRenderer key={i} block={b} />
            ))}
          </div>
        ) : (
          <>
            {card.body && (
              <p className="text-slate-700 leading-relaxed mb-4 text-base sm:text-lg">{card.body}</p>
            )}
            {card.bullets && (
              <ul className="space-y-3">
                {card.bullets.map((b, i) => (
                  <li key={i} className="flex gap-3 text-slate-600 leading-relaxed">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#EBF0FF] text-[#4F6BED] text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <div className="flex items-center justify-between mt-5 gap-3">
        <div className="flex items-center gap-3">
          {index > 0 ? (
            <button
              onClick={onPrev}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:border-[#4F6BED] hover:text-[#4F6BED] transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              上一页
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-1.5">
            {cards.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === index ? 'w-8 bg-[#4F6BED]' : 'w-1.5 bg-slate-200',
                )}
              />
            ))}
          </div>
        </div>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-medium shadow-md hover:shadow-lg transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg,#4F6BED,#7B61FF)' }}
        >
          {isLast ? (finalExam ? '开始结业考核 🎯' : '我学完了，去练习') : '下一页'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function LearnBlockRenderer({ block }: { block: import('@/lib/camp-data').LearnBlock }) {
  if (block.type === 'paragraph') {
    return <p className="text-slate-700 leading-relaxed text-[15px]">{block.text}</p>;
  }
  if (block.type === 'list') {
    const ListTag = block.ordered ? 'ol' : 'ul';
    return (
      <ListTag
        className={cn(
          'space-y-2.5 text-slate-700 leading-relaxed text-[15px]',
          block.ordered ? 'list-decimal pl-5 marker:text-[#4F6BED] marker:font-semibold' : '',
        )}
      >
        {block.items.map((t, i) => (
          <li key={i} className={block.ordered ? '' : 'flex gap-2.5'}>
            {!block.ordered && (
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#4F6BED] mt-2.5" />
            )}
            <span>{t}</span>
          </li>
        ))}
      </ListTag>
    );
  }
  if (block.type === 'table') {
    return (
      <div className="overflow-x-auto -mx-2 sm:mx-0">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {block.headers.map((h, i) => (
                <th
                  key={i}
                  className="text-left p-2.5 bg-[#EBF0FF] text-[#4F6BED] font-semibold border border-[#D6DFFB] first:rounded-tl-lg last:rounded-tr-lg whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri} className="even:bg-slate-50/60">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="p-2.5 border border-slate-100 align-top text-slate-700 leading-relaxed"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.type === 'quote') {
    return (
      <blockquote className="relative border-l-4 border-[#4F6BED] bg-[#F5F7FD] rounded-r-xl px-4 py-3.5 text-slate-700 leading-[1.85] whitespace-pre-line text-[15px]">
        {block.text}
      </blockquote>
    );
  }
  if (block.type === 'highlight') {
    const tone = block.tone || 'info';
    const styles = {
      info: { bg: 'bg-[#EBF0FF]', text: 'text-[#3651D1]', icon: '💡' },
      warn: { bg: 'bg-orange-50', text: 'text-[#C75B1E]', icon: '⚠️' },
      tip: { bg: 'bg-[#E6F9F1]', text: 'text-[#00855A]', icon: '✅' },
    }[tone];
    return (
      <div className={cn('flex gap-2.5 rounded-xl px-4 py-3 text-[15px] leading-relaxed', styles.bg, styles.text)}>
        <span className="flex-shrink-0">{styles.icon}</span>
        <span className="font-medium">{block.text}</span>
      </div>
    );
  }
  if (block.type === 'chain') {
    return (
      <div className="space-y-2">
        {block.steps.map((rawStep, i) => {
          const isLast = i === block.steps.length - 1;
          const step =
            typeof rawStep === 'string'
              ? { title: rawStep, desc: undefined }
              : rawStep;
          return (
            <div key={i} className="flex gap-3 items-start">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white',
                    isLast ? 'bg-gradient-to-br from-[#FF8A3D] to-[#FFB266]' : 'bg-[#4F6BED]',
                  )}
                >
                  {i + 1}
                </div>
                {!isLast && <div className="w-px flex-1 bg-[#D6DFFB] my-1 min-h-[12px]" />}
              </div>
              <div
                className={cn(
                  'flex-1 rounded-xl px-3.5 py-2.5 text-[15px] leading-relaxed',
                  isLast
                    ? 'bg-orange-50 text-[#C75B1E] font-semibold border border-[#FFD8B8]'
                    : 'bg-[#F5F7FD] text-slate-700',
                )}
              >
                <div>{step.title}</div>
                {step.desc && (
                  <div
                    className={cn(
                      'mt-1 text-[13px] leading-relaxed font-normal',
                      isLast ? 'text-[#C75B1E]/80' : 'text-slate-500',
                    )}
                  >
                    {step.desc}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  if (block.type === 'memo') {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[#4F6BED]/30 bg-gradient-to-br from-[#F5F7FD] to-white p-5">
        <div className="text-xs font-bold text-[#4F6BED] tracking-wider mb-3 flex items-center gap-1.5">
          <span>📌</span> 速记要点
        </div>
        <ul className="space-y-2.5">
          {block.items.map((t, i) => (
            <li key={i} className="flex gap-2.5 text-slate-700 leading-relaxed text-[15px]">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#4F6BED] text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return null;
}

// ========== 练 ==========
function PracticeStage({
  questions,
  maxScore,
  onDone,
}: {
  questions: PracticeQuestion[];
  maxScore: number;
  onDone: (score: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [scores, setScores] = useState<number[]>(() => questions.map(() => 0));
  const q = questions[idx];

  function finishThis(correct: boolean, score: number) {
    const next = [...scores];
    next[idx] = correct ? score : 0;
    setScores(next);
    if (idx < questions.length - 1) {
      setTimeout(() => setIdx(idx + 1), 800);
    } else {
      const total = next.reduce((a, b) => a + b, 0);
      setTimeout(() => onDone(total), 600);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-[#4F6BED] font-medium">
            🎯 互动练习 · 第 {idx + 1}/{questions.length} 题
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mt-1">{q.title}</h2>
          {'instruction' in q && q.instruction && (
            <p className="text-sm text-slate-500 mt-1">{q.instruction}</p>
          )}
        </div>
        <div className="text-xs text-slate-400 hidden sm:block">
          本题 {q.score} 分 · 答错可重试
        </div>
      </div>

      {/* 每题加 key，切题时强制重挂组件，重置选中/配对/排序等内部状态，避免残留旧状态导致卡住无法继续 */}
      {q.type === 'match' && <MatchPractice key={q.id} q={q} onFinish={finishThis} />}
      {q.type === 'order' && <OrderPractice key={q.id} q={q} onFinish={finishThis} />}
      {q.type === 'choice' && (
        <ChoicePractice key={q.id} q={q} onFinish={(correct) => finishThis(correct, q.score)} />
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        {idx > 0 ? (
          <button
            onClick={() => setIdx(idx - 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:border-[#4F6BED] hover:text-[#4F6BED] transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            上一题
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>累计得分：{scores.reduce((a, b) => a + b, 0)} / {maxScore} 分</span>
          <span>进度 {idx + 1} / {questions.length}</span>
        </div>
      </div>
    </div>
  );
}

function MatchPractice({
  q,
  onFinish,
}: {
  q: Extract<PracticeQuestion, { type: 'match' }>;
  onFinish: (correct: boolean, score: number) => void;
}) {
  // 右列打乱顺序（固定一次）
  const [rightOrder] = useState(() => {
    const arr = [...q.pairs];
    // 简单洗牌
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [wrong, setWrong] = useState<string | null>(null);

  function pickLeft(left: string) {
    if (matched[left]) return;
    setSelected(left);
  }
  function pickRight(right: string) {
    if (!selected) return;
    const pair = q.pairs.find((p) => p.left === selected);
    if (pair && pair.right === right) {
      setMatched({ ...matched, [selected]: right });
      setSelected(null);
      setWrong(null);
      if (Object.keys(matched).length + 1 === q.pairs.length) {
        onFinish(true, q.score);
      }
    } else {
      setWrong(right);
      setTimeout(() => setWrong(null), 600);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5">
      <div className="space-y-2.5">
        {q.pairs.map((p) => {
          const done = !!matched[p.left];
          const active = selected === p.left;
          return (
            <button
              key={p.left}
              onClick={() => pickLeft(p.left)}
              disabled={done}
              className={cn(
                'w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all',
                done
                  ? 'bg-[#E6F9F1] border-[#00B578] text-[#00B578]'
                  : active
                    ? 'bg-[#EBF0FF] border-[#4F6BED] shadow-sm'
                    : 'bg-white border-slate-200 hover:border-[#4F6BED]/40',
              )}
            >
              <div className="flex items-center gap-2">
                {done ? <CheckCircle2 className="w-4 h-4" /> : <GripVertical className="w-4 h-4 text-slate-300" />}
                <span className="text-sm sm:text-base font-medium">{p.left}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="space-y-2.5">
        {rightOrder.map((p) => {
          const done = Object.values(matched).includes(p.right);
          const isWrong = wrong === p.right;
          return (
            <button
              key={p.right}
              onClick={() => pickRight(p.right)}
              disabled={done}
              className={cn(
                'w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all',
                done
                  ? 'bg-[#E6F9F1] border-[#00B578] text-[#00B578]'
                  : isWrong
                    ? 'bg-red-50 border-red-400 animate-[shake_.3s]'
                    : 'bg-white border-slate-200 hover:border-[#4F6BED]/40',
              )}
            >
              <div className="flex items-center gap-2">
                {done ? <CheckCircle2 className="w-4 h-4" /> : null}
                <span className="text-sm sm:text-base">{p.right}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OrderPractice({
  q,
  onFinish,
}: {
  q: Extract<PracticeQuestion, { type: 'order' }>;
  onFinish: (correct: boolean, score: number) => void;
}) {
  // 打乱选项
  const [items, setItems] = useState<string[]>(() => {
    const arr = [...q.steps];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });
  const [picked, setPicked] = useState<string[]>([]);
  const [wrong, setWrong] = useState(false);
  const [done, setDone] = useState(false);

  function pick(text: string) {
    if (done) return;
    const next = [...picked, text];
    setPicked(next);
    setItems(items.filter((x) => x !== text));

    // 校验当前位置是否正确
    const idx = next.length - 1;
    if (q.steps[idx] !== text) {
      // 答错了，重置
      setWrong(true);
      setTimeout(() => {
        setPicked([]);
        setItems([...q.steps].sort(() => Math.random() - 0.5));
        setWrong(false);
      }, 800);
      return;
    }
    if (next.length === q.steps.length) {
      setDone(true);
      setTimeout(() => onFinish(true, q.score), 600);
    }
  }

  function reset() {
    setPicked([]);
    setItems([...q.steps].sort(() => Math.random() - 0.5));
  }

  return (
    <div>
      <div className="bg-white rounded-xl p-4 border border-slate-100 mb-4 min-h-[60px]">
        <div className="text-xs text-slate-400 mb-2">已排顺序（点击下方按钮按顺序加入）：</div>
        <div className="space-y-2">
          {picked.map((text, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-2 p-2.5 rounded-lg text-sm',
                wrong ? 'bg-red-50 text-red-600' : 'bg-[#EBF0FF] text-[#4F6BED]',
              )}
            >
              <span className="w-6 h-6 rounded-full bg-white text-[#4F6BED] text-xs font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              {text}
            </div>
          ))}
          {picked.length === 0 && !wrong && (
            <div className="text-sm text-slate-300 py-2">请按发生顺序点击下方选项...</div>
          )}
          {wrong && <div className="text-sm text-red-500">顺序有误，已重置，请再试一次</div>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((text, i) => (
          <button
            key={i}
            onClick={() => pick(text)}
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm hover:border-[#4F6BED] hover:text-[#4F6BED] transition-colors"
          >
            {text}
          </button>
        ))}
      </div>
      <button
        onClick={reset}
        className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
      >
        <RotateCcw className="w-3 h-3" /> 重置
      </button>
    </div>
  );
}

function ChoicePractice({
  q,
  onFinish,
}: {
  q: Extract<PracticeQuestion, { type: 'choice' }>;
  onFinish: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  function pick(i: number) {
    if (picked !== null) return;
    if (i === q.answer) {
      // 答对：高亮正确答案，由父级延时推进到下一题
      setPicked(i);
      setWrongIdx(null);
      onFinish(true);
    } else {
      // 答错：红色闪烁提示选错的选项，随后重置允许重试，不触发推进
      setWrongIdx(i);
      setTimeout(() => {
        setWrongIdx(null);
      }, 900);
    }
  }
  return (
    <div className="space-y-2.5">
      {q.options.map((opt, i) => {
        const isPicked = picked === i;
        const isAnswer = i === q.answer;
        const showCorrect = picked !== null && isAnswer;
        const showWrong = (isPicked && !isAnswer) || wrongIdx === i;
        return (
          <button
            key={i}
            onClick={() => pick(i)}
            disabled={picked !== null}
            className={cn(
              'w-full text-left p-4 rounded-xl border-2 transition-all',
              showCorrect
                ? 'bg-[#E6F9F1] border-[#00B578]'
                : showWrong
                  ? 'bg-red-50 border-red-400'
                  : 'bg-white border-slate-200 hover:border-[#4F6BED]/40',
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                  showCorrect
                    ? 'bg-[#00B578] text-white'
                    : showWrong
                      ? 'bg-red-400 text-white'
                      : 'bg-slate-100 text-slate-600',
                )}
              >
                {showCorrect ? <CheckCircle2 className="w-4 h-4" /> : showWrong ? <XCircle className="w-4 h-4" /> : String.fromCharCode(65 + i)}
              </div>
              <span className="text-sm sm:text-base">{opt}</span>
            </div>
          </button>
        );
      })}
      {picked !== null && (
        <div className="mt-3 p-3 rounded-lg bg-slate-50 text-sm text-slate-600">
          💡 {q.explanation}
        </div>
      )}
      {wrongIdx !== null && picked === null && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 text-sm text-red-600">
          答错了，再想想看～
        </div>
      )}
    </div>
  );
}

// ========== 考 ==========
function ExamStage({
  questions,
  maxScore,
  answers,
  textAnswers,
  submitting,
  onAnswer,
  onTextAnswer,
  onSubmit,
}: {
  questions: ExamQuestion[];
  maxScore: number;
  answers: Record<string, number>;
  textAnswers: Record<string, string>;
  submitting: boolean;
  onAnswer: (qid: string, optIdx: number) => void;
  onTextAnswer: (qid: string, val: string) => void;
  onSubmit: () => void;
}) {
  const objectiveQs = questions.filter((q) => q.type === 'single' || q.type === 'judge');
  const textQs = questions.filter((q): q is Extract<ExamQuestion, { type: 'text' }> => q.type === 'text');
  const answeredObjective = objectiveQs.filter((q) => answers[q.id] !== undefined).length;
  const answeredText = textQs.filter((q) => (textAnswers[q.id] || '').trim().length >= (q.minChars ?? 8)).length;
  const allObjectiveDone = objectiveQs.length === 0 || answeredObjective === objectiveQs.length;
  const progressLabel =
    textQs.length > 0
      ? `${answeredObjective}/${objectiveQs.length} 客观题 · ${answeredText}/${textQs.length} 简答题`
      : `${answeredObjective}/${objectiveQs.length} 题`;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-xs text-[#4F6BED] font-medium">📝 闯关考核 · {progressLabel}</div>
          <h2 className="text-xl sm:text-2xl font-bold mt-1">独立完成，认真作答</h2>
        </div>
        <div className="text-xs text-slate-400">
          考核满分 {maxScore} 分 · 70 分通关 · 简答题按得分点自动评分
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800">
        <b>⚠️ 考试规则：</b>本关共 <b>2 次</b>考试机会（首次 + 1 次重考）；
        只考 1 次按本次成绩计，<b>考满 2 次按两次成绩的平均分</b>作为最终成绩（重考分数更低也按平均算）；
        重考需<b>重新完成学习和练习</b>才能进入考试。请认真对待每一次考试。
      </div>

      <div className="space-y-4">
        {questions.map((q, qi) => {
          if (q.type === 'text') {
            const value = textAnswers[q.id] || '';
            const minChars = q.minChars ?? 8;
            const enough = value.trim().length >= minChars;
            return (
              <div key={q.id} className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-7 h-7 rounded-full bg-[#EBF0FF] text-[#4F6BED] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {qi + 1}
                  </div>
                  <div className="flex-1">
                    <div className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EBF0FF] text-[#4F6BED] mb-1.5">
                      ✍️ 简答题 · 系统按得分点自动评分
                    </div>
                    <div className="font-medium text-slate-800 leading-relaxed">{q.question}</div>
                  </div>
                </div>

                <div className="ml-10 space-y-2">
                  {q.referencePoints && q.referencePoints.length > 0 && (
                    <details className="rounded-lg bg-slate-50 ring-1 ring-slate-100 px-3 py-2 text-xs text-slate-500">
                      <summary className="cursor-pointer font-medium text-slate-600">
                        答题要点参考（作答时尽量覆盖，用自己的话写即可）
                      </summary>
                      <ul className="mt-2 list-disc pl-5 space-y-1">
                        {q.referencePoints.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <textarea
                    value={value}
                    onChange={(e) => onTextAnswer(q.id, e.target.value)}
                    rows={5}
                    placeholder="请用自己的话作答，尽量覆盖核心要点……"
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm leading-relaxed outline-none focus:border-[#4F6BED] focus:ring-2 focus:ring-[#4F6BED]/15 resize-y"
                  />
                  <div className={cn('text-xs flex justify-between', enough ? 'text-emerald-600' : 'text-slate-400')}>
                    <span>建议不少于 {minChars} 字</span>
                    <span>{value.trim().length} 字</span>
                  </div>
                </div>
              </div>
            );
          }

          if (q.type === 'single' || q.type === 'judge') {
            const picked = answers[q.id];
            return (
              <div key={q.id} className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-7 h-7 rounded-full bg-[#EBF0FF] text-[#4F6BED] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {qi + 1}
                  </div>
                  <div className="flex-1">
                    <div className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 mb-1.5">
                      {q.type === 'judge' ? '判断题' : '单选题'}
                    </div>
                    <div className="font-medium text-slate-800 leading-relaxed">{q.question}</div>
                  </div>
                </div>
                <div className="space-y-2 ml-10">
                  {q.options.map((opt, oi) => {
                    const isPicked = picked === oi;
                    const stateClass = isPicked
                      ? 'border-[#4F6BED] bg-[#EBF0FF]'
                      : 'border-slate-200 hover:border-[#4F6BED]/40 bg-white';
                    return (
                      <button
                        key={oi}
                        type="button"
                        onClick={() => onAnswer(q.id, oi)}
                        className={cn('w-full text-left p-3 rounded-xl border-2 transition-all', stateClass)}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                              isPicked ? 'bg-[#4F6BED] text-white' : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {q.type === 'judge' ? (oi === 0 ? '✓' : '✗') : String.fromCharCode(65 + oi)}
                          </div>
                          <span className="text-sm">{opt}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>

      <div className="mt-6 flex flex-col items-end gap-2">
        {!allObjectiveDone && (
          <div className="text-xs text-slate-400">请先完成所有客观题，简答题可以提交后由主管复核。</div>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!allObjectiveDone || submitting}
          className={cn(
            'inline-flex items-center gap-1.5 px-6 py-3 rounded-xl text-white text-sm font-medium shadow-md transition-all active:scale-95',
            allObjectiveDone && !submitting ? 'hover:shadow-lg' : 'opacity-50 cursor-not-allowed',
          )}
          style={{
            background:
              allObjectiveDone && !submitting
                ? 'linear-gradient(135deg,#4F6BED,#7B61FF)'
                : '#949CB2',
          }}
        >
          {submitting ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin" />
              正在提交…
            </>
          ) : (
            <>
              提交答卷并查看成绩
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ========== 结算 ==========
function ResultStage({
  result,
  subTitle,
  subId,
  levelId,
  nextSub,
  onHome,
  submitError,
  submitting,
  onRetry,
  onRetake,
  remainingAttempts,
  isFinalExam,
}: {
  result: StageResult;
  subTitle: string;
  subId: string;
  levelId: number;
  nextSub: { id: string; title: string } | null;
  onHome: () => void;
  submitError?: string | null;
  submitting?: boolean;
  onRetry?: () => void;
  onRetake?: () => void;
  remainingAttempts?: number;
  isFinalExam?: boolean;
}) {
  const totalMax = isFinalExam ? 99 : 100;
  const used = result.attempts || 1;
  const left = remainingAttempts ?? Math.max(0, 2 - used);
  return (
    <div className="max-w-[600px] mx-auto">
      <div
        className={cn(
          'rounded-2xl p-8 text-white text-center shadow-xl relative overflow-hidden',
          result.passed
            ? 'bg-gradient-to-br from-[#4F6BED] to-[#7B61FF]'
            : 'bg-gradient-to-br from-slate-400 to-slate-500',
        )}
      >
        <div className="absolute top-3 right-4 text-6xl opacity-20">
          {result.passed ? <Trophy /> : <Sparkles />}
        </div>
        <div className="text-5xl mb-3">
          {result.passed ? (result.stars === 3 ? '🏆' : result.stars === 2 ? '🎉' : '✅') : '💪'}
        </div>
        <h2 className="text-2xl font-bold mb-1">
          {result.passed ? `通关成功！` : '差一点点，再试一次！'}
        </h2>
        <p className="text-white/80 text-sm mb-5">{subTitle}</p>
        <div className="text-6xl font-bold mb-2">
          {result.total}
          <span className="text-2xl text-white/70"> / {totalMax}</span>
        </div>
        <div className="flex justify-center gap-1 mb-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                'text-3xl transition-all',
                i < result.stars ? 'text-[#FFB800] drop-shadow' : 'text-white/25',
              )}
            >
              ★
            </span>
          ))}
        </div>
        <div className="text-xs text-white/80 mb-2">
          {used >= 2
            ? `已用完 2 次考试机会 · 最终成绩为两次平均分`
            : `第 ${used} 次考试 · 还可重考 ${left} 次（最终成绩按两次平均分计）`}
        </div>
        {result.bonusGained > 0 && (
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FFB800]/30 text-yellow-100 text-xs font-medium">
            🎁 首次通关 +{result.bonusGained} 积分
          </div>
        )}
      </div>

      {/* 提交状态提示 */}
      {submitError ? (
        <div className="mt-4 rounded-2xl p-4 bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-2">
            <span className="text-amber-600 text-base leading-6">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 mb-1">成绩已保存在本机，但同步到排行榜时出现问题</p>
              <p className="text-xs text-amber-700 whitespace-pre-line leading-relaxed">{submitError}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  disabled={submitting}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 disabled:opacity-50"
                >
                  {submitting ? '重新上报中…' : '重新上报成绩'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl p-3 bg-green-50 border border-green-200 text-center">
          <p className="text-sm text-green-700 font-medium">✅ 成绩已提交成功</p>
          <p className="text-xs text-green-600 mt-0.5">当前总分 {result.total} 分，已计入排行榜</p>
        </div>
      )}

      {/* 段位升级 */}
      {result.rankUp && (
        <div className="mt-4 rounded-2xl p-5 bg-gradient-to-r from-[#FFB800]/10 to-[#FF8A3D]/10 border border-[#FFB800]/30 text-center">
          <div className="text-xs text-[#C75B1E] font-medium mb-1">🎊 段位提升</div>
          <div className="text-lg font-bold text-[#C75B1E]">
            恭喜升级到 {result.rankUp.icon} {result.rankUp.name}
          </div>
        </div>
      )}

      {/* 分数明细 */}
      <div className="mt-4 bg-white rounded-2xl p-5 border border-slate-100">
        <h3 className="font-bold mb-3 text-sm text-slate-700">
          {isFinalExam ? '成绩明细' : '分数明细'}
        </h3>
        <div className="space-y-3">
          {!isFinalExam && (
            <>
              <ScoreRow label="学 · 秘籍阅读" score={result.learn} max={20} />
              <ScoreRow label="练 · 互动练习" score={result.practice} max={30} />
            </>
          )}
          <ScoreRow label={isFinalExam ? '结业考核' : '考 · 闯关考核'} score={result.exam} max={isFinalExam ? totalMax : 50} />
          <div className="h-px bg-slate-100" />
          {used >= 2 && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 space-y-0.5">
              <div>第 1 次考试：<b className="text-slate-700">{result.attemptOneScore ?? '—'}</b> 分</div>
              <div>第 2 次考试：<b className="text-slate-700">{result.attemptTwoScore ?? '—'}</b> 分</div>
              <div className="text-amber-600">最终成绩 = 两次平均分</div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="font-medium">最终成绩{used >= 2 ? '（两次平均）' : ''}</span>
            <span className="font-bold text-[#4F6BED]">{result.total} / {totalMax}</span>
          </div>
        </div>
      </div>

      {/* 重考规则提示 + 重考入口 */}
      {left > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[13px] leading-relaxed text-amber-800">
            <b>重考规则：</b>你还有 <b>{left}</b> 次重考机会。重考需<b>重新完成学习和练习</b>后才能进入考试；
            最终成绩 = 本次成绩与重考成绩的<b>平均分</b>（即使重考分数更低也按平均计），请谨慎决定。
          </p>
          <button
            onClick={onRetake}
            className="mt-3 w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            🔁 重考本关（剩余 {left} 次）
          </button>
        </div>
      )}
      {left === 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
          本关 2 次考试机会已用完，最终成绩已锁定。
        </div>
      )}

      {/* 操作按钮 */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={onHome}
          className="py-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
        >
          返回首页
        </button>
        {nextSub && result.passed ? (
          <Link
            href={`/camp/learn/${nextSub.id}`}
            className="py-3 rounded-xl text-white text-sm font-medium text-center shadow-md hover:shadow-lg transition-all inline-flex items-center justify-center gap-1"
            style={{ background: 'linear-gradient(135deg,#4F6BED,#7B61FF)' }}
          >
            下一关：{nextSub.title} <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          <Link
            href="/camp"
            className="py-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium text-center hover:bg-slate-50"
          >
            返回闯关地图
          </Link>
        )}
      </div>

      <div className="mt-4 text-center">
        <Link href={`/camp/level/${levelId}`} className="text-xs text-slate-400 hover:text-[#4F6BED]">
          返回本关列表
        </Link>
      </div>
    </div>
  );
}

function ScoreRow({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-700">
          {score}
          <span className="text-xs text-slate-400"> / {max}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: pct >= 70 ? 'linear-gradient(90deg,#4F6BED,#7B61FF)' : '#FF8A3D',
          }}
        />
      </div>
    </div>
  );
}
