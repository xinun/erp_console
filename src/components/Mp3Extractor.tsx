'use client';

import { useEffect, useRef, useState } from 'react';
import type { FFmpeg } from '@ffmpeg/ffmpeg';

type ExtractState = 'idle' | 'loading' | 'converting' | 'success' | 'error';

const FFMPEG_CORE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

function IconMusic() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M9 18V5l10-2v13M9 8l10-2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mp3FileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'meeting';
  return `${baseName}.mp3`;
}

export default function Mp3Extractor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<ExtractState>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  const busy = state === 'loading' || state === 'converting';

  useEffect(() => () => {
    ffmpegRef.current?.terminate();
  }, []);

  const reset = () => {
    if (busy) return;
    setFile(null);
    setState('idle');
    setProgress(0);
    setMessage('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    reset();
  };

  const selectFile = (selected?: File) => {
    if (!selected) return;
    if (selected.size >= MAX_FILE_SIZE) {
      setFile(null);
      setState('error');
      setMessage('브라우저 변환 한도는 2GB 미만입니다. 더 작은 파일을 선택해주세요.');
      return;
    }
    setFile(selected);
    setState('idle');
    setProgress(0);
    setMessage('');
  };

  const extract = async () => {
    if (!file || busy) return;

    const inputName = `input-${Date.now()}.${file.name.split('.').pop()?.toLowerCase() || 'mp4'}`;
    const outputName = `output-${Date.now()}.mp3`;

    try {
      let ffmpeg = ffmpegRef.current;
      if (!ffmpeg) {
        setState('loading');
        setMessage('변환 엔진을 처음 한 번 불러오는 중입니다.');
        const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
          import('@ffmpeg/ffmpeg'),
          import('@ffmpeg/util'),
        ]);
        ffmpeg = new FFmpeg();
        ffmpeg.on('progress', ({ progress: value }) => {
          setProgress(Math.min(100, Math.max(0, Math.round(value * 100))));
        });
        await ffmpeg.load({
          coreURL: await toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegRef.current = ffmpeg;
      }

      setState('converting');
      setMessage('영상에서 음성을 추출하고 있습니다. 이 창을 닫지 마세요.');
      setProgress(0);

      const inputData = new Uint8Array(await file.arrayBuffer());
      await ffmpeg.writeFile(inputName, inputData);
      const exitCode = await ffmpeg.exec([
        '-i', inputName,
        '-map', '0:a:0',
        '-vn',
        '-codec:a', 'libmp3lame',
        '-b:a', '128k',
        outputName,
      ]);
      if (exitCode !== 0) throw new Error('음성 트랙을 MP3로 변환하지 못했습니다.');

      const result = await ffmpeg.readFile(outputName);
      if (typeof result === 'string') throw new Error('MP3 결과 파일 형식이 올바르지 않습니다.');
      const mp3Bytes = Uint8Array.from(result);
      const url = URL.createObjectURL(new Blob([mp3Bytes], { type: 'audio/mpeg' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = mp3FileName(file.name);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

      await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);
      setProgress(100);
      setState('success');
      setMessage(`${mp3FileName(file.name)} 다운로드를 시작했습니다.`);
    } catch (error) {
      const ffmpeg = ffmpegRef.current;
      if (ffmpeg) await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);
      setState('error');
      setMessage(error instanceof Error ? error.message : 'MP3 변환 중 오류가 발생했습니다.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <IconMusic />
        <span className="hidden sm:inline">MP3 추출</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-5">
          <button type="button" className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]" onClick={close} aria-label="MP3 추출 창 닫기" />
          <section role="dialog" aria-modal="true" aria-labelledby="mp3-extractor-title" className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="mp3-extractor-title" className="text-base font-semibold text-slate-900">영상에서 MP3 추출</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">파일은 서버로 전송하지 않고 현재 브라우저에서만 처리합니다.</p>
              </div>
              <button type="button" onClick={close} disabled={busy} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label="닫기">
                <IconClose />
              </button>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="video/*,.mp4,.mkv,.mov,.webm,.avi,.wmv"
              className="hidden"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!busy) selectFile(event.dataTransfer.files[0]);
              }}
              className="mt-5 flex min-h-36 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center transition-colors hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white"><IconMusic /></span>
              <span className="mt-3 text-sm font-semibold text-slate-700">{file ? file.name : '영상 파일 선택 또는 끌어놓기'}</span>
              <span className="mt-1 text-xs text-slate-400">{file ? formatBytes(file.size) : 'MP4, MKV, MOV, WebM · 2GB 미만'}</span>
            </button>

            {file && file.size > 500 * 1024 * 1024 && state === 'idle' && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">큰 파일은 변환 시간이 오래 걸리거나 브라우저 메모리가 부족할 수 있습니다.</p>
            )}

            {busy && (
              <div className="mt-4" aria-live="polite">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{message}</span>
                  <span>{state === 'loading' ? '준비 중' : `${progress}%`}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full bg-slate-900 transition-[width] ${state === 'loading' ? 'w-1/3 animate-pulse' : ''}`} style={state === 'converting' ? { width: `${progress}%` } : undefined} />
                </div>
              </div>
            )}

            {(state === 'success' || state === 'error') && (
              <p className={`mt-4 rounded-lg px-3 py-2 text-xs leading-5 ${state === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`} aria-live="polite">{message}</p>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-400">출력: MP3 · 128 kbps</p>
              <div className="flex gap-2">
                {file && !busy && (
                  <button type="button" onClick={reset} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">다른 파일</button>
                )}
                <button
                  type="button"
                  onClick={extract}
                  disabled={!file || busy}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {busy ? '변환 중...' : 'MP3 추출 및 다운로드'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
