import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { changePassword } from '@/lib/admin-accounts';

/** 修改自己的密码（需已登录）。 */
export async function POST(req: NextRequest) {
  const identity = verifyAdmin(req);
  if (!identity) {
    return NextResponse.json({ success: false, error: '未登录或登录已过期' }, { status: 401 });
  }
  if (identity.username === 'admin' && identity.role === 'super') {
    // 明文口令登录的超管没有账号记录，不允许改密
    return NextResponse.json(
      { success: false, error: '当前是管理口令登录，请先用 admin 账号登录后再改密码' },
      { status: 400 },
    );
  }

  try {
    const body = (await req.json()) as { oldPassword?: unknown; newPassword?: unknown };
    const oldPassword = typeof body.oldPassword === 'string' ? body.oldPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const result = await changePassword(identity.username, oldPassword, newPassword);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error || '修改失败' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/change-password] error', message);
    return NextResponse.json({ success: false, error: `修改失败: ${message}` }, { status: 500 });
  }
}
