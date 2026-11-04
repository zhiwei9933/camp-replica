import { NextRequest, NextResponse } from 'next/server';
import { readWeakEntries, type WeakEntry } from '@/lib/camp-weak';

// 学员个人错题本：只读，直接 GET 自己的 camp_weak:{city}:{staffName} 单 key，不 SCAN 全库。
// 数据为考核环节非满分题目的派生视图；成绩库 camp_results 不参与、不修改。
export async function GET(req: NextRequest) {
  const city = (req.nextUrl.searchParams.get('city') || '').trim();
  const staffName = (req.nextUrl.searchParams.get('staffName') || '').trim();

  if (!city || !staffName) {
    return NextResponse.json(
      { success: false, error: '缺少 city 或 staffName 参数' },
      { status: 400 },
    );
  }

  try {
    const entries = await readWeakEntries(city, staffName);
    // 按提交时间倒序（新错在前）
    const sorted = [...entries].sort((a: WeakEntry, b: WeakEntry) =>
      (a.submittedAt || '') < (b.submittedAt || '') ? 1 : -1,
    );
    return NextResponse.json({
      success: true,
      city,
      staffName,
      total: sorted.length,
      entries: sorted,
    });
  } catch (err) {
    console.error('[my-weak] read camp_weak failed:', err);
    return NextResponse.json(
      { success: false, error: '读取错题失败，请稍后重试' },
      { status: 500 },
    );
  }
}
