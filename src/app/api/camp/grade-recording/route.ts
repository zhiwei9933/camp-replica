import { NextRequest, NextResponse } from 'next/server';
import { readRecordings, writeRecordings } from '@/lib/camp-recordings';
import { readAllResults, upsertResult, type SubLevelResult } from '../submit-result/route';
import { recomputeBestScore, recomputeExamScore } from '@/lib/camp-scoring';

interface GradeBody {
  id: string;
  score: number; // 0-100
  comment?: string;
  gradedBy?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<GradeBody>;
    const { id, score, comment, gradedBy } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少记录 id' }, { status: 400 });
    }
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
      return NextResponse.json(
        { success: false, error: '分数必须是 0–100 的数字' },
        { status: 400 },
      );
    }

    const list = await readRecordings();
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) {
      return NextResponse.json({ success: false, error: '未找到该录音记录' }, { status: 404 });
    }

    const updated = {
      ...list[idx],
      score: Math.round(score),
      comment: typeof comment === 'string' ? comment.trim().slice(0, 500) : null,
      gradedBy: gradedBy || 'admin',
      gradedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    await writeRecordings(list);

    // 录音评分变化后，重算对应员工该小关的考核分/总分并更新 camp_results，
    // 排行榜由 camp_results 实时聚合，下次拉取即反映新分数。
    let updatedResult: SubLevelResult | null = null;
    const results = await readAllResults();
    const match = results.find(
      (r) => r.staffName === updated.employee && r.city === updated.city && r.subId === updated.levelId,
    );
    if (match) {
      const breakdown = match.examBreakdown;
      if (breakdown) {
        // 收集该员工该小关的全部录音（含其他题目和本次），用于逐题取最新评分
        const userRecs = list.filter(
          (r) =>
            r.employee === updated.employee && r.city === updated.city && r.levelId === updated.levelId,
        );
        const newExamScore = recomputeExamScore(breakdown, {
          overrides: Object.fromEntries(
            userRecs
              .filter((r) => typeof r.score === 'number')
              .map((r) => [r.questionId, r.score as number]),
          ),
        });
        const { bestScore, examScore } = recomputeBestScore(match, newExamScore);

        updatedResult = {
          ...match,
          examScore,
          bestScore,
          stars: Math.max(match.stars ?? 0, starFromScore(bestScore)),
          graded: true,
        };
        await upsertResult(updatedResult, 'merge', {
          examScore,
          bestScore,
          stars: updatedResult.stars,
          graded: true,
        });
      } else {
        // 旧数据没有 breakdown，无法重算明细，仅标记已评分
        updatedResult = { ...match, graded: true };
        await upsertResult(updatedResult, 'merge', { graded: true });
      }
    }

    return NextResponse.json({ success: true, record: updated, result: updatedResult });
  } catch (error) {
    console.error('[grade-recording] error', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `评分失败: ${message}` },
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
