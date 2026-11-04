import type { ExamBreakdown, TextQuestionScore } from './camp-data';
import type { SubLevelResult } from '@/app/api/camp/submit-result/route';

/**
 * Recompute examScore for a standard/final exam breakdown.
 *
 * New text-based flow:
 *   - objective questions: fixed score = objectiveCorrect * objectivePerPoint
 *   - text questions: score = textPerPoint * awarded factor (0 / 0.5 / 1)
 *     Admin may override awarded via `overrides` map (questionId -> new factor).
 *
 * Legacy oral/recording flow (kept for backwards compatibility with old data):
 *   falls back to oralQuestionIds / scenarioQuestionIds + recordings passed in.
 */
export function recomputeExamScore(
  breakdown: ExamBreakdown,
  options?: {
    overrides?: Record<string, number>;
  },
): number {
  const overrides = options?.overrides ?? {};

  // 新文字题流程
  if (breakdown.textScores && breakdown.textScores.length > 0) {
    const objective = breakdown.objectiveCorrect * breakdown.objectivePerPoint;
    const textPart = breakdown.textScores.reduce((sum, s) => {
      const awarded = Object.prototype.hasOwnProperty.call(overrides, s.questionId)
        ? clampAward(overrides[s.questionId])
        : s.awarded;
      return sum + breakdown.textPerPoint * awarded;
    }, 0);
    return Math.round(objective + textPart);
  }

  // 旧录音流程兼容：若无录音也无评分，按 objective + oral/scenario 暂记满分
  const oralIds = breakdown.oralQuestionIds ?? [];
  const scenarioIds = breakdown.scenarioQuestionIds ?? [];
  const objective = breakdown.objectiveCorrect * breakdown.objectivePerPoint;
  const oralPart = oralIds.length * (breakdown.oralPerPoint ?? breakdown.objectivePerPoint);
  const scenarioPart = scenarioIds.length * (breakdown.scenarioPerPoint ?? 0);
  return Math.round(objective + oralPart + scenarioPart);
}

function clampAward(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n >= 1) return 1;
  if (n >= 0.5) return 0.5;
  return 0;
}

/**
 * Apply manual adjustments from admin to text scores, returning new textScores array.
 */
export function applyTextScoreOverrides(
  scores: TextQuestionScore[],
  overrides: Record<string, number>,
): TextQuestionScore[] {
  return scores.map((s) => {
    if (!Object.prototype.hasOwnProperty.call(overrides, s.questionId)) return s;
    const awarded = clampAward(overrides[s.questionId]);
    return {
      ...s,
      awarded,
      hitCount: awarded === 1 ? s.totalPoints : awarded === 0.5 ? Math.ceil(s.totalPoints / 2) : 0,
      ratio: awarded,
    };
  });
}

/**
 * Recompute bestScore from examScore.
 * standard: learn(20) + practice + exam, cap 100
 * final: examScore itself, cap examMax
 */
export function recomputeBestScore(
  result: SubLevelResult,
  newExamScore: number,
): { bestScore: number; examScore: number } {
  if (result.examBreakdown?.kind === 'final') {
    const examMax = result.examBreakdown.examMax;
    const examScore = Math.max(0, Math.min(examMax, Math.round(newExamScore)));
    return { bestScore: examScore, examScore };
  }
  const learn = result.learnScore ?? 20;
  const practice = result.practiceScore ?? 0;
  const examScore = Math.max(
    0,
    Math.min(result.examBreakdown?.examMax ?? 50, Math.round(newExamScore)),
  );
  const rawTotal = learn + practice + examScore;
  const bestScore = Math.min(100, rawTotal);
  return { bestScore, examScore };
}
