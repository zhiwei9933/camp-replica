import { NextRequest, NextResponse } from 'next/server';
import { upstashCommand } from '@/lib/upstash';

const REDIS_KEY = 'training_results';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staffName, city, roundNumber, roundTitle, totalScore, dimensionScores, coachingPoints, dialogues, submittedAt } = body;

    if (!staffName || !city || !roundNumber || totalScore === undefined) {
      return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
    }

    const newResult = {
      staffName,
      city,
      roundNumber,
      roundTitle,
      totalScore,
      dimensionScores: dimensionScores || {},
      coachingPoints: coachingPoints || [],
      dialogues: dialogues || [],
      submittedAt,
    };

    // 1. GET current results
    const currentData = await upstashCommand(['GET', REDIS_KEY]);
    let results: Record<string, unknown>[] = [];
    if (currentData && currentData !== 'null') {
      try {
        results = JSON.parse(currentData as string);
      } catch {
        results = [];
      }
    }

    // 2. Append new result
    results.push(newResult);

    // 3. Filter out records older than 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    results = results.filter((r: Record<string, unknown>) => {
      const t = new Date(r.submittedAt as string).getTime();
      return t > sevenDaysAgo;
    });

    // 4. SET new results
    await upstashCommand(['SET', REDIS_KEY, JSON.stringify(results)]);

    // 5. EXPIRE 7 days
    await upstashCommand(['EXPIRE', REDIS_KEY, '604800']);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[training/submit-result] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: `训练成绩提交失败: ${message}` }, { status: 500 });
  }
}
