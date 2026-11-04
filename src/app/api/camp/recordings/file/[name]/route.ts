import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { findRecordingFile, recordingMimeFromName } from '@/lib/camp-recordings';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const abs = await findRecordingFile(decodeURIComponent(name));
  if (!abs) {
    return new NextResponse('Not Found', { status: 404 });
  }
  try {
    const data = await fs.readFile(abs);
    const mime = recordingMimeFromName(name);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=3600',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('[recording-file] read error', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
