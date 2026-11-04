import { NextRequest, NextResponse } from 'next/server';
import { upstashCommand } from '@/lib/upstash';
import { verifyAdmin } from '@/lib/admin-auth';

const REDIS_KEY = 'training_results';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const identity = verifyAdmin(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: '未登录或登录已过期', results: [] }, { status: 401 });
  }
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

    const scoped = identity.role === 'manager'
      ? filtered.filter((r) => r.city === identity.city)
      : filtered;

    return NextResponse.json({ success: true, results: scoped });
  } catch (error) {
    console.error('[admin/training-results] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: `获取训练成绩失败: ${message}`, results: [] }, { status: 500 });
  }
}
