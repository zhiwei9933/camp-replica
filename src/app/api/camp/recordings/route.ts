import { NextRequest, NextResponse } from 'next/server';
import { readRecordings, type RecordingRecord } from '@/lib/camp-recordings';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city') || '';
    const levelId = searchParams.get('levelId') || '';
    const status = searchParams.get('status') || ''; // graded | pending
    const employee = searchParams.get('employee') || '';
    const limit = Math.min(Number(searchParams.get('limit') || 200), 500);

    let list: RecordingRecord[] = await readRecordings();

    if (city) list = list.filter((r) => r.city === city);
    if (levelId) list = list.filter((r) => r.levelId === levelId);
    if (employee)
      list = list.filter((r) => r.employee.toLowerCase().includes(employee.toLowerCase()));
    if (status === 'graded') list = list.filter((r) => r.score !== null && r.score !== undefined);
    if (status === 'pending') list = list.filter((r) => r.score === null || r.score === undefined);

    list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    const total = list.length;
    list = list.slice(0, limit);

    return NextResponse.json({ success: true, total, recordings: list });
  } catch (error) {
    console.error('[list-recordings] error', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `查询失败: ${message}` },
      { status: 500 },
    );
  }
}
