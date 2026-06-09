'use client';

import { ClipResult } from '@/lib/worker';

interface ClipCardProps {
  clip: ClipResult;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ClipCard({ clip }: ClipCardProps) {
  return (
    <div className="group rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:border-orange-500/40 hover:bg-white/[0.07]">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-md bg-orange-500/20 px-2 py-0.5 text-xs font-semibold text-orange-400">
              #{clip.index}
            </span>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/50">
              Score {clip.score}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white">{clip.title}</h3>
        </div>
        <span className="shrink-0 rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-white/60">
          {formatDuration(clip.duration)}
        </span>
      </div>

      {/* Hook */}
      <p className="mb-4 text-xs italic text-white/50">"{clip.hook}"</p>

      {/* Timestamps */}
      <div className="mb-4 flex items-center gap-2 text-xs text-white/30">
        <span>{formatTimestamp(clip.start)}</span>
        <span className="flex-1 border-t border-dashed border-white/10" />
        <span>{formatTimestamp(clip.end)}</span>
      </div>

      {/* Download button */}
      <a
        href={clip.url}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-400 active:scale-95"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download clip
      </a>
    </div>
  );
}
