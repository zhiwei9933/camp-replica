import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { addAccount, deleteAccount, listSafeAccounts, resetPassword } from '@/lib/admin-accounts';
import type { AdminRole } from '@/lib/admin-auth';

/** 仅超管可管理账号。 */
function requireSuper(req: NextRequest) {
  const identity = verifyAdmin(req);
  if (!identity) {
    return { identity: null, res: NextResponse.json({ success: false, error: '未登录或登录已过期' }, { status: 401 }) };
  }
  if (identity.role !== 'super') {
    return { identity: null, res: NextResponse.json({ success: false, error: '只有超级管理员可以管理账号' }, { status: 403 }) };
  }
  return { identity, res: null };
}

/** 账号列表 */
export async function GET(req: NextRequest) {
  const { res } = requireSuper(req);
  if (res) return res;
  try {
    const accounts = await listSafeAccounts();
    return NextResponse.json({ success: true, accounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: `读取账号失败: ${message}` }, { status: 500 });
  }
}

/** 新增账号 */
export async function POST(req: NextRequest) {
  const { res } = requireSuper(req);
  if (res) return res;
  try {
    const body = (await req.json()) as {
      username?: unknown;
      name?: unknown;
      role?: unknown;
      city?: unknown;
      password?: unknown;
    };
    const username = typeof body.username === 'string' ? body.username : '';
    const name = typeof body.name === 'string' ? body.name : '';
    const role = body.role === 'super' || body.role === 'manager' ? (body.role as AdminRole) : null;
    const city = typeof body.city === 'string' && body.city ? body.city : null;
    const password = typeof body.password === 'string' ? body.password : '';
    if (!role) {
      return NextResponse.json({ success: false, error: '请选择角色' }, { status: 400 });
    }
    const result = await addAccount(username, name, role, city, password);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: `新增失败: ${message}` }, { status: 500 });
  }
}

/** 删除账号 ?username=xxx */
export async function DELETE(req: NextRequest) {
  const { identity, res } = requireSuper(req);
  if (res || !identity) return res as NextResponse;
  try {
    const username = req.nextUrl.searchParams.get('username')?.trim() || '';
    if (!username) {
      return NextResponse.json({ success: false, error: '缺少 username' }, { status: 400 });
    }
    const result = await deleteAccount(username, identity.username);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: `删除失败: ${message}` }, { status: 500 });
  }
}

/** 重置他人密码 { username, newPassword } */
export async function PATCH(req: NextRequest) {
  const { res } = requireSuper(req);
  if (res) return res;
  try {
    const body = (await req.json()) as { username?: unknown; newPassword?: unknown };
    const username = typeof body.username === 'string' ? body.username : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const result = await resetPassword(username, newPassword);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: `重置失败: ${message}` }, { status: 500 });
  }
}
