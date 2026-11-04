import { NextRequest, NextResponse } from 'next/server';
import { getQuizResults, EXPIRE_SECONDS } from '@/lib/upstash';
import { verifyAdmin } from '@/lib/admin-auth';

interface QuizResult {
  staffName: string;
  city: string;
  chapterId: number;
  chapterName: string;
  score: number;
  passed: boolean;
  submittedAt: string;
}

export async function GET(request: NextRequest) {
  const identity = verifyAdmin(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: '未登录或登录已过期', results: [] }, { status: 401 });
  }
  try {
    const results = await getQuizResults();

    // 过滤超过 7 天的记录
    const sevenDaysAgo = Date.now() - Number(EXPIRE_SECONDS) * 1000;
    const validResults = (results as QuizResult[]).filter(
      (r) => r.submittedAt && new Date(r.submittedAt).getTime() > sevenDaysAgo
    );

    // 按提交时间倒序排列
    validResults.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    // 项目主管只能看到本项目数据
    const scoped = identity.role === 'manager'
      ? validResults.filter((r) => r.city === identity.city)
      : validResults;

    return NextResponse.json({ success: true, results: scoped });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Admin Results] 查询失败:', message);
    return NextResponse.json(
      { success: false, error: `查询失败: ${message}`, results: [] },
      { status: 500 }
    );
  }
}
