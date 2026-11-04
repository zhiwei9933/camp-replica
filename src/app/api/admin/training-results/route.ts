import { NextResponse } from 'next/server';
import { upstashCommand } from '@/lib/upstash';

const REDIS_KEY = 'training_results';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const data = await upstashCommand(['GET', REDIS_KEY]);
    if (!data || data === 'null') {
      return NextResponse.json({ success: true, results: [] });
    }

    const results = JSON.parse(data as string) as Record<string, unknown>[];
    const cutoff = Date.now() - SEVEN_DAYS_MS;

    const filtered = results
      .filter(r => new Date(r.submittedAt as string).getTime() > cutoff)
      .sort((a, b) => new Date(b.submittedAt as string).getTime() - new Date(a.submittedAt as string).getTime());

    return NextResponse.json({ success: true, results: filtered });
  } catch (error) {
    console.error('[admin/training-results] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: `获取训练成绩失败: ${message}`, results: [] }, { status: 500 });
  }
}
