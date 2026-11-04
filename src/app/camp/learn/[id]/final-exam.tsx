'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import {
  FINAL_EXAM_INFO,
  pickFinalQuestions,
  type FinalJudgeQuestion,
  type FinalOralQuestion,
} from '@/lib/camp/chapter8';
import { scoreTextQuestion, type TextQuestionScore } from '@/lib/camp-text-scoring';
import type { ObjectiveQuestionScore } from '@/lib/camp-data';
import { cn } from '@/lib/utils';

interface FinalExamProps {
  onFinish: (result: {
    score: number;
    totalScore: number;
    passed: boolean;
    judgeCorrect: number;
    judgeTotal: number;
    textQuestionIds: string[];
    textScores: TextQuestionScore[];
    objectiveScores: ObjectiveQuestionScore[];
  }) => void;
}

interface FinalResult {
  score: number;
  judgeScore: number;
  oralScore: number;
  scenarioScore: number;
  judgeCorrect: number;
  judgeTotal: number;
  textScores: TextQuestionScore[];
  objectiveScores: ObjectiveQuestionScore[];
}

export function FinalExam({ onFinish }: FinalExamProps) {
  const picked = useMemo(() => pickFinalQuestions(), []);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<FinalResult | null>(null);

  const answeredJudge = picked.judge.filter((q) => answers[q.id] !== undefined).length;
  const answeredOral = picked.oral.filter(
    (q) => (textAnswers[q.id] || '').trim().length >= (q.minChars ?? 10),
  ).length;
  const answeredScenario = picked.scenario.filter(
    (q) => (textAnswers[q.id] || '').trim().length >= (q.minChars ?? 10),
  ).length;

  const canSubmit =
    answeredJudge === picked.judge.length &&
    answeredOral === picked.oral.length &&
    answeredScenario === picked.scenario.length &&
    !submitting;

  function setAnswer(qid: string, idx: number) {
    setAnswers((prev) => ({ ...prev, [qid]: idx }));
  }
  function setText(qid: string, val: string) {
    setTextAnswers((prev) => ({ ...prev, [qid]: val }));
  }

  async function doSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // 判断题
      let judgeScore = 0;
      let judgeCorrect = 0;
      const objectiveScores: ObjectiveQuestionScore[] = [];
      for (const q of picked.judge) {
        const chosen = typeof answers[q.id] === 'number' ? answers[q.id] : -1;
        const isCorrect = chosen === q.answer;
        if (isCorrect) {
          judgeScore += q.score;
          judgeCorrect += 1;
        }
        objectiveScores.push({
          questionId: q.id,
          type: 'judge',
          chosen,
          correct: q.answer,
          isCorrect,
          score: isCorrect ? q.score : 0,
          maxScore: q.score,
        });
      }

      // 简答题（口试 7 分）自动评分
      const textScores: TextQuestionScore[] = [];
      let oralScore = 0;
      for (const q of picked.oral) {
        const s = scoreTextQuestion(q, textAnswers[q.id] || '');
        textScores.push({ ...s, maxScore: q.score });
        oralScore += q.score * s.awarded;
      }

      // 情景题（6 分）自动评分
      let scenarioScore = 0;
      for (const q of picked.scenario) {
        const s = scoreTextQuestion(q, textAnswers[q.id] || '');
        textScores.push({ ...s, maxScore: q.score });
        scenarioScore += q.score * s.awarded;
      }

      const score = Math.round(judgeScore + oralScore + scenarioScore);
      const r: FinalResult = {
        score,
        judgeScore,
        oralScore,
        scenarioScore,
        judgeCorrect,
        judgeTotal: picked.judge.length,
        textScores,
        objectiveScores,
      };
      setResult(r);

      const textQuestionIds = [...picked.oral, ...picked.scenario].map((q) => q.id);
      onFinish({
        score,
        totalScore: FINAL_EXAM_INFO.totalScore,
        passed: score >= FINAL_EXAM_INFO.passScore,
        judgeCorrect,
        judgeTotal: picked.judge.length,
        textQuestionIds,
        textScores,
        objectiveScores,
      });
    } catch (e) {
      console.error('[final-exam] 提交失败', e);
      setSubmitError(
        e instanceof Error ? `提交失败：${e.message}，请重试` : '提交失败，请重试',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const allTextQs: Array<FinalOralQuestion & { kind: 'oral' | 'scenario' }> = [
    ...picked.oral.map((q) => ({ ...q, kind: 'oral' as const })),
    ...picked.scenario.map((q) => ({ ...q, kind: 'scenario' as const })),
  ];

  return (
    <div>
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_rgba(79,107,237,0.06)] border border-slate-100 mb-4">
        <div className="flex items-center gap-2 text-[#4F6BED] mb-2">
          <Sparkles className="w-5 h-5" />
          <span className="font-bold">结业考核</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-slate-800">
              {answeredOral}/{picked.oral.length}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">简答题（7分/题）</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">
              {answeredScenario}/{picked.scenario.length}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">情景题（6分/题）</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">
              {answeredJudge}/{picked.judge.length}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">判断题（4分/题）</div>
          </div>
        </div>
        <div className="mt-3 text-center text-xs text-slate-400">
          满分 {FINAL_EXAM_INFO.totalScore} 分 · {FINAL_EXAM_INFO.passScore} 分及格
        </div>
      </div>

      {/* 考试规则提醒 */}
      <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] leading-relaxed text-amber-800">
        ⚠️ <b>考试规则：</b>结业考核共 <b>2 次</b>考试机会（首次 + 1 次重考）；最终成绩 = 两次考试<b>平均分</b>（四舍五入）；
        {FINAL_EXAM_INFO.passScore} 分通关。重考需<b>重新完成学习</b>后才能进入考试，请认真对待每一次考试。
      </div>

      {submitError && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3">
          ⚠️ {submitError}
        </div>
      )}

      <div className="space-y-4">
        {/* 简答题 */}
        {allTextQs.map((q, qi) => (
          <TextItem
            key={q.id}
            q={q}
            index={qi + 1}
            kind={q.kind}
            value={textAnswers[q.id] || ''}
            score={result?.textScores.find((s) => s.questionId === q.id)}
            onChange={(v) => setText(q.id, v)}
          />
        ))}

        {/* 判断题 */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100">
          <div className="text-sm font-bold text-slate-700 mb-3">
            三、判断题（{picked.judge.length} 题，每题 {FINAL_EXAM_INFO.judgeScore} 分）
          </div>
          <div className="space-y-3">
            {picked.judge.map((q, qi) => (
              <JudgeItem
                key={q.id}
                q={q}
                index={picked.oral.length + picked.scenario.length + qi + 1}
                picked={answers[q.id]}
                onPick={(idx) => setAnswer(q.id, idx)}
              />
            ))}
          </div>
        </div>
      </div>

      {result ? (
        <ResultCard result={result} />
      ) : (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => void doSubmit()}
            disabled={!canSubmit}
            className={cn(
              'inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-medium shadow-md transition-all active:scale-95',
              canSubmit ? 'hover:shadow-lg' : 'opacity-50 cursor-not-allowed',
            )}
            style={{
              background: canSubmit
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
                交卷并查看成绩
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function TextItem({
  q,
  index,
  kind,
  value,
  score,
  onChange,
}: {
  q: FinalOralQuestion;
  index: number;
  kind: 'oral' | 'scenario';
  value: string;
  score?: TextQuestionScore;
  onChange: (v: string) => void;
}) {
  const minChars = q.minChars ?? 10;
  const enough = value.trim().length >= minChars;
  const label = kind === 'oral' ? `简答题（${q.score} 分）` : `情景题（${q.score} 分）`;
  const color = kind === 'oral' ? 'bg-[#EBF0FF] text-[#4F6BED]' : 'bg-purple-50 text-purple-600';
  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-7 h-7 rounded-full bg-[#EBF0FF] text-[#4F6BED] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
          {index}
        </div>
        <div className="flex-1">
          <div className={cn('inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mb-1.5', color)}>
            ✍️ {label}
          </div>
          <div className="font-medium text-slate-800 leading-relaxed">{q.question}</div>
        </div>
      </div>

      <div className="ml-10 space-y-2">
        <details className="rounded-lg bg-slate-50 ring-1 ring-slate-100 px-3 py-2 text-xs text-slate-500">
          <summary className="cursor-pointer font-medium text-slate-600">
            答题要点参考（尽量覆盖，用自己的话写即可）
          </summary>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            {q.referencePoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </details>

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          placeholder="请用自己的话作答……"
          className="w-full rounded-xl border border-slate-200 p-3 text-sm leading-relaxed outline-none focus:border-[#4F6BED] focus:ring-2 focus:ring-[#4F6BED]/15 resize-y"
        />

        {score ? (
          <div
            className={cn(
              'rounded-lg px-3 py-2 text-xs',
              score.awarded >= 1
                ? 'bg-emerald-50 text-emerald-700'
                : score.awarded >= 0.5
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-red-50 text-red-700',
            )}
          >
            <div className="font-medium">
              自动评分：{score.awarded >= 1 ? '满分' : score.awarded >= 0.5 ? '半分' : '0 分'}
              （命中 {score.hitCount}/{score.totalPoints} 个得分点，每题 {q.score} 分，得 {q.score * score.awarded} 分）
            </div>
            {score.matchedKeywords.length > 0 && (
              <div className="mt-1 opacity-80">命中关键词：{score.matchedKeywords.join('、')}</div>
            )}
          </div>
        ) : (
          <div className={cn('text-xs flex justify-between', enough ? 'text-emerald-600' : 'text-slate-400')}>
            <span>建议不少于 {minChars} 字</span>
            <span>{value.trim().length} 字</span>
          </div>
        )}
      </div>
    </div>
  );
}

function JudgeItem({
  q,
  index,
  picked,
  onPick,
}: {
  q: FinalJudgeQuestion;
  index: number;
  picked?: number;
  onPick: (idx: number) => void;
}) {
  return (
    <div>
      <div className="flex items-start gap-2 mb-2">
        <span className="text-slate-400 text-sm font-medium mt-0.5">{index}.</span>
        <span className="text-sm text-slate-700 flex-1 leading-relaxed">{q.question}</span>
      </div>
      <div className="flex gap-2 ml-6">
        {q.options.map((opt, oi) => {
          const isPicked = picked === oi;
          return (
            <button
              key={oi}
              type="button"
              onClick={() => onPick(oi)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all',
                isPicked
                  ? oi === 0
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-red-400 bg-red-50 text-red-600'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}
            >
              {oi === 0 ? '✓ ' : '✗ '}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: FinalResult }) {
  const passed = result.score >= FINAL_EXAM_INFO.passScore;
  return (
    <div
      className={cn(
        'mt-6 rounded-2xl p-6 border text-center',
        passed
          ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
          : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200',
      )}
    >
      {passed ? (
        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
      ) : (
        <XCircle className="w-12 h-12 mx-auto text-amber-500 mb-2" />
      )}
      <div className="text-2xl font-bold text-slate-800">
        {passed ? '🎉 考核通过' : '继续加油'}
      </div>
      <div className="mt-2 text-4xl font-black text-[#4F6BED]">{result.score}</div>
      <div className="text-sm text-slate-500">满分 {FINAL_EXAM_INFO.totalScore} · 及格 {FINAL_EXAM_INFO.passScore}</div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs max-w-sm mx-auto">
        <div className="bg-white/70 rounded-lg p-2">
          <div className="font-bold text-slate-700">{result.judgeScore}</div>
          <div className="text-slate-500">判断题</div>
        </div>
        <div className="bg-white/70 rounded-lg p-2">
          <div className="font-bold text-slate-700">{Math.round(result.oralScore)}</div>
          <div className="text-slate-500">简答题</div>
        </div>
        <div className="bg-white/70 rounded-lg p-2">
          <div className="font-bold text-slate-700">{Math.round(result.scenarioScore)}</div>
          <div className="text-slate-500">情景题</div>
        </div>
      </div>
    </div>
  );
}
