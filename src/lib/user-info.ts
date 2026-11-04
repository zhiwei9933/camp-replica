// 用户信息类型
export type ProjectType = 'hefei' | 'hangzhou';

export interface UserInfo {
  name: string;
  project: ProjectType;
}

// 项目名称映射
export const PROJECT_NAMES: Record<ProjectType, string> = {
  hefei: '合肥',
  hangzhou: '杭州',
};

export const PROJECT_HOSPITAL_NAMES: Record<ProjectType, string> = {
  hefei: '合肥天佑白癜风医院',
  hangzhou: '杭州华研白癜风医院',
};

// 项目选项
export const PROJECT_OPTIONS: { value: ProjectType; label: string; desc: string }[] = [
  { value: 'hefei', label: '合肥', desc: '合肥天佑白癜风医院' },
  { value: 'hangzhou', label: '杭州', desc: '杭州华研白癜风医院' },
];

const STORAGE_KEY = 'quiz_user_info';

// 保存用户信息
export function saveUserInfo(info: UserInfo): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
}

// 获取用户信息
export function getUserInfo(): UserInfo | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as UserInfo;
  } catch {
    return null;
  }
}

// 清除用户信息
export function clearUserInfo(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// 检查用户信息是否完整
export function hasUserInfo(): boolean {
  const info = getUserInfo();
  return !!info && !!info.name && !!info.project;
}
