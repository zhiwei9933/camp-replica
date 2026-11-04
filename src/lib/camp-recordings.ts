import { promises as fs } from 'fs';
import path from 'path';
import { upstashCommand } from './upstash';

export const RECORDINGS_KEY = 'camp_recordings';
export const RECORDINGS_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface RecordingRecord {
  id: string;
  employee: string;
  city: string;
  levelId: string;
  questionId: string;
  questionText: string;
  audioUrl: string;
  fileName: string;
  duration: number;
  submittedAt: string;
  score: number | null; // 0-100, 后台人工评分
  comment: string | null;
  gradedBy?: string;
  gradedAt?: string;
}

function recordingsDir(): string {
  // 生产环境唯一可写目录是 /tmp；开发环境同样可用 /tmp，避免污染项目目录
  const base = process.env.CAMP_RECORDINGS_DIR || '/tmp/camp-recordings';
  return base;
}

export async function ensureRecordingsDir(): Promise<string> {
  const dir = recordingsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w.\u4e00-\u9fa5-]/g, '_').slice(0, 200);
}

export async function readRecordings(): Promise<RecordingRecord[]> {
  const raw = await upstashCommand(['GET', RECORDINGS_KEY]);
  if (!raw || raw === 'null') return [];
  try {
    const parsed = JSON.parse(raw as string);
    return Array.isArray(parsed) ? (parsed as RecordingRecord[]) : [];
  } catch {
    return [];
  }
}

export async function writeRecordings(list: RecordingRecord[]): Promise<void> {
  const cutoff = Date.now() - RECORDINGS_TTL_SECONDS * 1000;
  const filtered = list.filter((r) => new Date(r.submittedAt).getTime() > cutoff);
  await upstashCommand(['SET', RECORDINGS_KEY, JSON.stringify(filtered)]);
  await upstashCommand(['EXPIRE', RECORDINGS_KEY, String(RECORDINGS_TTL_SECONDS)]);
}

export async function saveRecordingFile(file: File): Promise<{ fileName: string; absPath: string }> {
  const dir = await ensureRecordingsDir();
  const buf = Buffer.from(await file.arrayBuffer());
  const rawName = file.name || `recording_${Date.now()}.webm`;
  const fileName = safeFileName(rawName);
  const absPath = path.join(dir, fileName);
  await fs.writeFile(absPath, buf);
  return { fileName, absPath };
}

export async function findRecordingFile(fileName: string): Promise<string | null> {
  const safe = path.basename(safeFileName(fileName));
  const abs = path.join(recordingsDir(), safe);
  try {
    await fs.access(abs);
    return abs;
  } catch {
    return null;
  }
}

export function recordingMimeFromName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.mp4' || ext === '.m4a') return 'audio/mp4';
  if (ext === '.ogg') return 'audio/ogg';
  return 'audio/webm';
}
