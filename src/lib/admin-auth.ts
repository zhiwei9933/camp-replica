// 管理后台危险操作（删除学员账号等）的服务端鉴权。
// 学员端是「姓名+城市」免密身份，绝不能据此执行删除；删除必须持有管理口令。
//
// 口令来源优先级：环境变量 CAMP_ADMIN_TOKEN；未配置时使用下面的内置默认口令。
// 内置口令仅用于没有独立密钥管理的部署，生产建议通过环境变量覆盖。
export const DEFAULT_ADMIN_TOKEN = 'camp-admin-2026-7x2q';

const HEADER_NAMES = ['x-admin-token', 'authorization'];

export function getAdminToken(): string {
  const envToken = process.env.CAMP_ADMIN_TOKEN?.trim();
  return envToken && envToken.length > 0 ? envToken : DEFAULT_ADMIN_TOKEN;
}

function extractToken(req: Request): string {
  for (const name of HEADER_NAMES) {
    const v = req.headers.get(name);
    if (!v) continue;
    const trimmed = v.trim();
    if (name === 'authorization' && /^bearer\s+/i.test(trimmed)) {
      return trimmed.replace(/^bearer\s+/i, '').trim();
    }
    return trimmed;
  }
  return '';
}

/** 校验请求是否携带正确的管理口令。仅用于写操作（删除等危险动作）。 */
export function isAuthorizedAdmin(req: Request): boolean {
  const token = extractToken(req);
  if (!token) return false;
  const expected = getAdminToken();
  // 长度一致再做常量时间比较，降低时序侧信道风险
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
