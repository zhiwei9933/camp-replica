'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, Play, Pause, RotateCcw, AlertCircle } from 'lucide-react';

interface AudioRecorderProps {
  maxDuration?: number; // 秒
  minDuration?: number; // 秒
  onRecorded: (data: { blob: Blob; duration: number; mimeType: string }) => void;
  disabled?: boolean;
}

type RecorderState = 'idle' | 'recording' | 'recorded' | 'unsupported' | 'denied';

function pickMimeType(): string {
  if (typeof window === 'undefined' || !window.MediaRecorder) return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const t of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      // ignore
    }
  }
  return '';
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function AudioRecorder({
  maxDuration = 120,
  minDuration = 10,
  onRecorded,
  disabled = false,
}: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string>('');
  const recordedMimeRef = useRef<string>('');
  const cancelledRef = useRef(false);

  // 检测浏览器支持
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported =
      !!navigator.mediaDevices?.getUserMedia &&
      typeof window.MediaRecorder !== 'undefined';
    if (!supported) {
      setState('unsupported');
      setErrorMsg('当前浏览器不支持录音，请使用最新版 Chrome、Edge 或 Safari。');
    }
    return () => {
      cleanup();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  const stopTracksOnly = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMsg('');
    cancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMimeType();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recordedMimeRef.current = mime || recorder.mimeType || 'audio/webm';

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        stopTracksOnly();
        if (cancelledRef.current) {
          chunksRef.current = [];
          return;
        }
        const blob = new Blob(chunksRef.current, {
          type: recordedMimeRef.current || 'audio/webm',
        });
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = URL.createObjectURL(blob);
        setElapsed(duration);
        setState('recorded');
        if (duration < minDuration) {
          setErrorMsg(`录音时长 ${duration} 秒，少于最低要求 ${minDuration} 秒，请重新录制。`);
        }
        onRecorded({ blob, duration, mimeType: recordedMimeRef.current });
      };

      startTimeRef.current = Date.now();
      recorder.start();
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(sec);
        if (sec >= maxDuration && mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 200);
    } catch (err) {
      cleanup();
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setState('denied');
        setErrorMsg('麦克风权限被拒绝，请在浏览器地址栏中允许麦克风后重试。');
      } else if (name === 'NotFoundError') {
        setState('unsupported');
        setErrorMsg('未检测到麦克风设备。');
      } else {
        setErrorMsg('无法启动录音：' + ((err as Error).message || '未知错误'));
      }
    }
  }, [cleanup, maxDuration, minDuration, onRecorded, stopTracksOnly]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetRecording = useCallback(() => {
    cancelledRef.current = true;
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = '';
    }
    chunksRef.current = [];
    setElapsed(0);
    setErrorMsg('');
    setPlaying(false);
    setState('idle');
    onRecorded({ blob: new Blob(), duration: 0, mimeType: '' });
  }, [cleanup, onRecorded]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  }, [playing]);

  const ext = (() => {
    const mime = recordedMimeRef.current;
    if (mime.includes('mp4')) return 'mp4';
    if (mime.includes('ogg')) return 'ogg';
    return 'webm';
  })();

  const tooShort = state === 'recorded' && elapsed < minDuration;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-center gap-4">
        {state === 'recording' ? (
          <>
            <button
              type="button"
              onClick={stopRecording}
              disabled={disabled}
              className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 active:scale-95 disabled:opacity-50"
              aria-label="停止录音"
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-red-400/60" />
              <Square className="relative h-6 w-6 fill-white" />
            </button>
            <div className="flex-1 min-w-[180px]">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-sm font-medium text-red-600">录音中…</span>
                <span className="ml-2 font-mono text-lg font-bold tabular-nums text-slate-800">
                  {formatTime(elapsed)}
                </span>
                <span className="text-xs text-slate-400">/ {formatTime(maxDuration)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">点击按钮停止录音，到时会自动停止</p>
            </div>
          </>
        ) : state === 'recorded' ? (
          <>
            <button
              type="button"
              onClick={togglePlay}
              disabled={disabled || !audioUrlRef.current}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[#4F6BED] text-white shadow-md transition hover:bg-[#3B54D4] active:scale-95 disabled:opacity-50"
              aria-label={playing ? '暂停' : '播放'}
            >
              {playing ? (
                <Pause className="h-5 w-5 fill-white" />
              ) : (
                <Play className="ml-0.5 h-5 w-5 fill-white" />
              )}
            </button>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <span className="font-semibold">录音完成</span>
                <span className="rounded-md bg-white px-2 py-0.5 font-mono text-xs tabular-nums text-slate-600 ring-1 ring-slate-200">
                  {formatTime(elapsed)}
                </span>
                <span className="text-xs text-slate-400">.{ext}</span>
                {tooShort && (
                  <span className="text-xs font-medium text-red-500">时长不足，请重录</span>
                )}
              </div>
              <audio
                ref={audioRef}
                src={audioUrlRef.current || undefined}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                className="mt-2 w-full"
                controls
              />
            </div>
            <button
              type="button"
              onClick={resetRecording}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              重新录制
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={startRecording}
              disabled={disabled || state === 'unsupported'}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#4F6BED] to-[#7B61FF] text-white shadow-lg transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="开始录音"
            >
              <Mic className="h-7 w-7" />
            </button>
            <div className="flex-1 min-w-[180px]">
              <div className="text-sm font-medium text-slate-700">
                {state === 'denied' ? '麦克风权限未开启' : '点击麦克风开始录音'}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                建议时长 {minDuration}–{maxDuration} 秒，浏览器会请求麦克风权限
              </p>
              {state === 'denied' && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="mt-2 text-xs font-medium text-[#4F6BED] hover:underline"
                >
                  重试授权
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {errorMsg && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}

export default AudioRecorder;
