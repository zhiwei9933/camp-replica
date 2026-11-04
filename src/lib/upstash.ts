// Upstash Redis REST API 工具函数

import { isLocalStoreEnabled, localCommand } from './local-store';

/**
 * 执行单个 Upstash Redis 命令
 * POST 到 UPSTASH_REDIS_URL，body 为 JSON 数组格式 ["COMMAND", "arg1", "arg2"]
 * 返回 {"result": "..."}
 *
 * 未配置 Upstash 环境变量时自动降级到本地文件存储（复刻版新增，见 local-store.ts）。
 */
export interface UpstashCommandOptions {
  /** 单次命令超时（毫秒）。默认 8000ms，超时主动 abort，避免请求永久挂起 */
  timeoutMs?: number;
}

export async function upstashCommand(args: string[], opts?: UpstashCommandOptions): Promise<unknown> {
  if (isLocalStoreEnabled()) {
    return localCommand(args);
  }

  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) {
    throw new Error('Upstash Redis 环境变量未配置 (UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN)');
  }

  const timeoutMs = opts?.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted) {
      throw new Error(`Upstash 请求超时(>${timeoutMs}ms): ${args[0]}`);
    }
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Upstash 连接失败(${args[0]}): ${reason}`);
  }
  clearTimeout(timer);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash API 错误 [${res.status}]: ${text}`);
  }

  const data = await res.json();
  return data.result;
}

// 成绩存储 key
export const QUIZ_RESULTS_KEY = 'quiz_results';

// 7 天过期时间（秒）
export const EXPIRE_SECONDS = '604800';

/**
 * 获取所有成绩记录
 */
export async function getQuizResults(): Promise<unknown[]> {
  const result = await upstashCommand(['GET', QUIZ_RESULTS_KEY]);
  if (!result || typeof result !== 'string') return [];
  try {
    return JSON.parse(result);
  } catch {
    return [];
  }
}

/**
 * 追加成绩记录并清理过期数据
 * 使用 3 次单命令调用：GET → SET → EXPIRE
 */
export async function appendQuizResult(newResult: Record<string, unknown>): Promise<void> {
  // 1. 获取现有记录
  const existing = await getQuizResults();

  // 2. 过滤超过 7 天的旧记录
  const sevenDaysAgo = Date.now() - Number(EXPIRE_SECONDS) * 1000;
  const filtered = (existing as Record<string, unknown>[]).filter((r) => {
    const submittedAt = r.submittedAt as string;
    return submittedAt && new Date(submittedAt).getTime() > sevenDaysAgo;
  });

  // 3. 追加新记录
  const updated = [...filtered, newResult];
  const jsonStr = JSON.stringify(updated);

  // 4. 写回 Redis
  await upstashCommand(['SET', QUIZ_RESULTS_KEY, jsonStr]);

  // 5. 设置过期时间
  await upstashCommand(['EXPIRE', QUIZ_RESULTS_KEY, EXPIRE_SECONDS]);
}
