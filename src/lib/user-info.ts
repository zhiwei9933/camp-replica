// 用户信息类型
export type ProjectType = 'nanchang' | 'changsha' | 'shanghai' | 'ningbo' | 'wenzhou' | 'ganzhou';

export interface UserInfo {
  name: string;
  project: ProjectType;
}

// 项目名称映射
export const PROJECT_NAMES: Record<ProjectType, string> = {
  nanchang: '南昌',
  changsha: '长沙',
  shanghai: '上海',
  ningbo: '宁波',
  wenzhou: '温州',
  ganzhou: '赣州',
};

export const PROJECT_HOSPITAL_NAMES: Record<ProjectType, string> = {
  nanchang: '南昌国丹白癜风医院',
  changsha: '长沙华研白癜风医院',
  shanghai: '上海华研白癜风医院',
  ningbo: '宁波华仁白癜风医院',
  wenzhou: '温州中研白癜风医院',
  ganzhou: '赣州中研白癜风医院',
};

// 项目选项
export const PROJECT_OPTIONS: { value: ProjectType; label: string; desc: string }[] = [
  { value: 'nanchang', label: '南昌', desc: '南昌国丹医院' },
  { value: 'changsha', label: '长沙', desc: '长沙华研医院' },
  { value: 'shanghai', label: '上海', desc: '上海项目' },
  { value: 'ningbo', label: '宁波', desc: '宁波项目' },
  { value: 'wenzhou', label: '温州', desc: '温州中研白癜风医院' },
  { value: 'ganzhou', label: '赣州', desc: '赣州中研白癜风医院' },
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
