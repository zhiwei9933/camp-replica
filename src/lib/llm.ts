/**
 * 统一 LLM 入口。
 *
 * - 扣子编程环境内：未配置 LLM_API_KEY 时，沿用 coze-coding-dev-sdk（自动注入内部凭证）。
 * - 部署到外部云服务时：配置 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL，
 *   走任意 OpenAI 兼容接口（DeepSeek、通义、豆包方舟、智谱、OpenAI 等）。
 */
import { LLMClient, Config } from 'coze-coding-dev-sdk';

export type LLMMessage = { role: string; content: string };
export type LLMOptions = { model?: string; temperature?: number; streaming?: boolean };
export type LLMChunk = { content: string };
export type LLMResult = { content: string };

export interface LLMLike {
  invoke(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResult>;
  stream(messages: LLMMessage[], options?: LLMOptions): AsyncIterable<LLMChunk>;
}

const BASE_URL = (process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
const API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
const MODEL = process.env.LLM_MODEL || 'deepseek-chat';

/** 是否使用外部 OpenAI 兼容接口 */
export function isExternalLLM(): boolean {
  return Boolean(API_KEY);
}

function toOpenAIMessages(messages: LLMMessage[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

async function openaiInvoke(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResult> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: toOpenAIMessages(messages),
      temperature: options?.temperature ?? 0.7,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM 请求失败 ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return { content: data.choices?.[0]?.message?.content || '' };
}

async function* openaiStream(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<LLMChunk> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: toOpenAIMessages(messages),
      temperature: options?.temperature ?? 0.7,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM 流式请求失败 ${res.status}: ${text.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield { content: delta };
      } catch {
        // 忽略无法解析的心跳片段
      }
    }
  }
}

/**
 * 创建 LLM 客户端。
 * headers 仅在扣子环境内需要透传，外部模式下会被忽略。
 */
export function createLLM(headers?: Record<string, string>): LLMLike {
  if (isExternalLLM()) {
    return {
      invoke: openaiInvoke,
      stream: openaiStream,
    };
  }
  return new LLMClient(new Config(), headers) as unknown as LLMLike;
}
