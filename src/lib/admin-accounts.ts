// 后台账号表：账号存 Redis 单 key，密码用 scrypt + 随机盐散列保存。
// 首次访问自动写入三个默认账号（超管 + 两个项目主管），登录页会提示修改密码。

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { upstashCommand } from '@/lib/upstash';
import type { AdminIdentity, AdminRole } from '@/lib/admin-auth';

const ACCOUNTS_KEY = 'camp_admin_accounts';

export interface AdminAccount extends AdminIdentity {
  salt: string;
  hash: string;
}

interface DefaultAccount {
  username: string;
  name: string;
  role: AdminRole;
  city: string | null;
  password: string;
}

export const DEFAULT_ACCOUNTS: DefaultAccount[] = [
  { username: 'admin', name: '超级管理员', role: 'super', city: null, password: 'admin888' },
  { username: 'hefei', name: '合肥主管', role: 'manager', city: 'hefei', password: 'hefei888' },
  { username: 'hangzhou', name: '杭州主管', role: 'manager', city: 'hangzhou', password: 'hangzhou888' },
];

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

export function makeAccount(
  username: string,
  name: string,
  role: AdminRole,
  city: string | null,
  password: string,
): AdminAccount {
  const salt = randomBytes(16).toString('hex');
  return { username, name, role, city, salt, hash: hashPassword(password, salt) };
}

export async function readAccounts(): Promise<AdminAccount[]> {
  const raw = await upstashCommand(['GET', ACCOUNTS_KEY], { timeoutMs: 15000 });
  if (raw === null || raw === undefined || raw === 'null') return [];
  try {
    const arr = JSON.parse(String(raw));
    return Array.isArray(arr) ? (arr as AdminAccount[]) : [];
  } catch {
    return [];
  }
}

export async function saveAccounts(accounts: AdminAccount[]): Promise<void> {
  await upstashCommand(['SET', ACCOUNTS_KEY, JSON.stringify(accounts)], { timeoutMs: 15000 });
}

/** 读取账号表；为空时写入默认账号并返回。 */
export async function ensureAccounts(): Promise<AdminAccount[]> {
  const existing = await readAccounts();
  if (existing.length > 0) return existing;
  const created = DEFAULT_ACCOUNTS.map((d) => makeAccount(d.username, d.name, d.role, d.city, d.password));
  await saveAccounts(created);
  return created;
}

export function checkPassword(account: AdminAccount, password: string): boolean {
  const attempt = Buffer.from(hashPassword(password, account.salt), 'hex');
  const stored = Buffer.from(account.hash, 'hex');
  if (attempt.length !== stored.length) return false;
  return timingSafeEqual(attempt, stored);
}

export async function authenticate(username: string, password: string): Promise<AdminAccount | null> {
  const accounts = await ensureAccounts();
  const account = accounts.find((a) => a.username === username);
  if (!account) return null;
  return checkPassword(account, password) ? account : null;
}

export async function changePassword(
  username: string,
  oldPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  if (newPassword.length < 6) return { ok: false, error: '新密码至少 6 位' };
  const accounts = await ensureAccounts();
  const idx = accounts.findIndex((a) => a.username === username);
  if (idx < 0) return { ok: false, error: '账号不存在' };
  if (!checkPassword(accounts[idx], oldPassword)) return { ok: false, error: '原密码不正确' };
  const salt = randomBytes(16).toString('hex');
  accounts[idx] = { ...accounts[idx], salt, hash: hashPassword(newPassword, salt) };
  await saveAccounts(accounts);
  return { ok: true };
}

export function toIdentity(account: AdminAccount): AdminIdentity {
  return { username: account.username, name: account.name, role: account.role, city: account.city };
}
