import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  readRecordings,
  writeRecordings,
  saveRecordingFile,
  type RecordingRecord,
} from '@/lib/camp-recordings';

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const audio = form.get('audio');
    const employee = String(form.get('employee') || '').trim();
    const city = String(form.get('city') || '').trim();
    const levelId = String(form.get('levelId') || '').trim();
    const questionId = String(form.get('questionId') || '').trim();
    const questionText = String(form.get('questionText') || '').trim();
    const duration = Number(form.get('duration') || 0);

    if (!audio || !(audio instanceof File)) {
      return NextResponse.json({ success: false, error: '缺少录音文件' }, { status: 400 });
    }
    if (!employee || !city || !levelId || !questionId) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数 employee/city/levelId/questionId' },
        { status: 400 },
      );
    }

    const { fileName } = await saveRecordingFile(audio);
    const record: RecordingRecord = {
      id: `rec_${Date.now()}_${randomUUID().slice(0, 8)}`,
      employee,
      city,
      levelId,
      questionId,
      questionText,
      audioUrl: `/api/camp/recordings/file/${encodeURIComponent(fileName)}`,
      fileName,
      duration: Number.isFinite(duration) ? Math.round(duration) : 0,
      submittedAt: new Date().toISOString(),
      score: null,
      comment: null,
    };

    const list = await readRecordings();
    list.push(record);
    await writeRecordings(list);

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error('[upload-recording] error', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `录音上传失败: ${message}` },
      { status: 500 },
    );
  }
}
