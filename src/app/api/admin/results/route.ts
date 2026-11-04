import { NextResponse } from 'next/server';
import { getQuizResults, EXPIRE_SECONDS } from '@/lib/upstash';

interface QuizResult {
  staffName: string;
  city: string;
  chapterId: number;
  chapterName: string;
  score: number;
  passed: boolean;
  submittedAt: string;
}

export async function GET() {
  try {
    const results = await getQuizResults();

    // 过滤超过 7 天的记录
    const sevenDaysAgo = Date.now() - Number(EXPIRE_SECONDS) * 1000;
    const validResults = (results as QuizResult[]).filter(
      (r) => r.submittedAt && new Date(r.submittedAt).getTime() > sevenDaysAgo
    );

    // 按提交时间倒序排列
    validResults.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    return NextResponse.json({ success: true, results: validResults });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Admin Results] 查询失败:', message);
    return NextResponse.json(
      { success: false, error: `查询失败: ${message}`, results: [] },
      { status: 500 }
    );
  }
}
