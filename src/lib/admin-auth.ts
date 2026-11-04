// 管理后台鉴权：兼容旧的单一管理口令 + 新增「超管 / 项目主管」角色会话。
//
// 旧机制：请求头 x-admin-token 携带 CAMP_ADMIN_TOKEN（或内置默认值）即视为管理员。
// 新机制：账号密码登录后拿到 HMAC 签名会话 token，内含角色与所属项目；
//        服务端按角色强制过滤数据，主管无法越权查看其他项目。
//
// 会话签名密钥复用 CAMP_ADMIN_TOKEN，避免额外要求部署方配置新变量。

import { createHmac } from 'crypto';

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

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 校验请求是否携带正确的旧版管理口令（保留给一次性迁移脚本等场景）。 */
export function isAuthorizedAdmin(req: Request): boolean {
  const token = extractToken(req);
  if (!token) return false;
  return safeEqual(token, getAdminToken());
}

// ===================== 角色会话 =====================

export type AdminRole = 'super' | 'manager';

export interface AdminIdentity {
  username: string;
  name: string;
  /** super = 超管，可看全部项目；manager = 项目主管，只能看自己项目 */
  role: AdminRole;
  /** 主管绑定的项目 slug（hefei / hangzhou），超管为 null */
  city: string | null;
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 小时

function secret(): string {
  return `admin-session::${getAdminToken()}`;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function unb64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function signSession(identity: AdminIdentity): string {
  const payload = { ...identity, exp: Date.now() + SESSION_TTL_MS };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

/**
 * 解析请求身份。返回 null 表示未登录 / token 无效 / 已过期。
 * 旧的明文管理口令会被识别为超管，保证升级后不会把原管理员锁在门外。
 */
export function verifyAdmin(req: Request): AdminIdentity | null {
  const token = extractToken(req);
  if (!token) return null;

  if (safeEqual(token, getAdminToken())) {
    return { username: 'admin', name: '超级管理员', role: 'super', city: null };
  }

  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;
  const body = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expectSig = b64url(createHmac('sha256', secret()).update(body).digest());
  if (!safeEqual(sig, expectSig)) return null;

  try {
    const p = JSON.parse(unb64url(body).toString('utf8')) as Partial<AdminIdentity> & { exp?: number };
    if (!p || typeof p.exp !== 'number' || Date.now() > p.exp) return null;
    if (p.role !== 'super' && p.role !== 'manager') return null;
    if (typeof p.username !== 'string' || !p.username) return null;
    return {
      username: p.username,
      name: typeof p.name === 'string' ? p.name : p.username,
      role: p.role,
      city: p.role === 'manager' && typeof p.city === 'string' ? p.city : null,
    };
  } catch {
    return null;
  }
}

/** 主管只能访问自己项目；超管不受限制。 */
export function canAccessCity(identity: AdminIdentity, city: string | null | undefined): boolean {
  if (identity.role === 'super') return true;
  if (!identity.city) return false;
  return city === identity.city;
}
