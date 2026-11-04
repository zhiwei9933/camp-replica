import { NextRequest, NextResponse } from 'next/server';
import { authenticate, toIdentity } from '@/lib/admin-accounts';
import { signSession } from '@/lib/admin-auth';

/** 后台账号密码登录，成功后返回带角色信息的会话 token。 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { username?: unknown; password?: unknown };
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !password) {
      return NextResponse.json({ success: false, error: '请输入账号和密码' }, { status: 400 });
    }

    const account = await authenticate(username, password);
    if (!account) {
      return NextResponse.json({ success: false, error: '账号或密码不正确' }, { status: 401 });
    }

    const identity = toIdentity(account);
    return NextResponse.json({
      success: true,
      token: signSession(identity),
      user: identity,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/login] error', message);
    return NextResponse.json({ success: false, error: `登录失败: ${message}` }, { status: 500 });
  }
}
