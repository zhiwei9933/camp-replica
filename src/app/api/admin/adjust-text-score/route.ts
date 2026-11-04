import { NextRequest, NextResponse } from 'next/server';
import { readAllResults, upsertResult, type SubLevelResult } from '../../camp/submit-result/route';
import {
  applyTextScoreOverrides,
  recomputeBestScore,
  recomputeExamScore,
} from '@/lib/camp-scoring';

interface AdjustBody {
  staffName: string;
  city: string;
  subId: string;
  questionId: string;
  /** 新的得分系数：0 / 0.5 / 1 */
  awarded: number;
  comment?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<AdjustBody>;
    const { staffName, city, subId, questionId } = body;
    const awarded = Number(body.awarded);

    if (!staffName || !city || !subId || !questionId) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数 staffName/city/subId/questionId' },
        { status: 400 },
      );
    }
    if (![0, 0.5, 1].includes(awarded)) {
      return NextResponse.json(
        { success: false, error: 'awarded 必须是 0 / 0.5 / 1' },
        { status: 400 },
      );
    }

    const results = await readAllResults();
    const match = results.find(
      (r) => r.staffName === staffName && r.city === city && r.subId === subId,
    );
    if (!match) {
      return NextResponse.json({ success: false, error: '未找到对应成绩记录' }, { status: 404 });
    }
    if (!match.examBreakdown || !match.examBreakdown.textScores) {
      return NextResponse.json(
        { success: false, error: '该成绩不包含简答题评分明细，无法调整' },
        { status: 400 },
      );
    }

    const target = match.examBreakdown.textScores.find((s) => s.questionId === questionId);
    if (!target) {
      return NextResponse.json(
        { success: false, error: '该小关没有找到对应简答题' },
        { status: 404 },
      );
    }

    const overrides = { [questionId]: awarded };
    const newTextScores = applyTextScoreOverrides(match.examBreakdown.textScores, overrides);
    const newBreakdown = {
      ...match.examBreakdown,
      textScores: newTextScores,
    };
    const newExamScore = recomputeExamScore(newBreakdown);
    const { bestScore, examScore } = recomputeBestScore(match, newExamScore);

    const updatedResult: SubLevelResult = {
      ...match,
      examScore,
      bestScore,
      stars: Math.max(match.stars ?? 0, starFromScore(bestScore)),
      graded: true,
      examBreakdown: newBreakdown,
      gradedAt: new Date().toISOString(),
      gradedComment: body.comment?.slice(0, 500) ?? match.gradedComment,
    };

    await upsertResult(updatedResult, 'merge', {
      examScore,
      bestScore,
      stars: updatedResult.stars,
      graded: true,
      gradedAt: updatedResult.gradedAt,
      gradedComment: updatedResult.gradedComment,
      examBreakdown: newBreakdown,
    });

    return NextResponse.json({
      success: true,
      result: updatedResult,
      examScore,
      bestScore,
    });
  } catch (error) {
    console.error('[adjust-text-score] error', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `调整失败: ${message}` },
      { status: 500 },
    );
  }
}

function starFromScore(score: number): number {
  if (score >= 90) return 3;
  if (score >= 80) return 2;
  if (score >= 70) return 1;
  return 0;
}
