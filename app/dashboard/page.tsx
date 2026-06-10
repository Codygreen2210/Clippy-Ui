'use client';

import { Suspense } from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Word { word: string; start: number; end: number; }

interface DimGrade { grade: string; reason: string; }
interface Breakdown {
  hook:  DimGrade;
  flow:  DimGrade;
  value: DimGrade;
  trend: DimGrade;
}

interface ClipResult {
  index: number;
  title: string;
  hook: string;
  score: number;
  start: number;
  end: number;
  duration: number;
  url: string;
  thumbnail_url?: string | null;
  breakdown?: Breakdown | null;
  extending?: boolean;
  extend_error?: string | null;
}

interface SavedTranscript {
  segments?: { start: number; end: number; text: string }[];
  words?: Word[];
}

interface JobStatus {
  id: string;
  status: string;
  step?: string;
  clips: ClipResult[] | null;
  error: string | null;
  segments?: SavedTranscript | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ─── Transcript extend panel ──────────────────────────────────────────────────

const CONTEXT_SECS = 20; // seconds of transcript to show before/after clip

function TranscriptPanel({
  clip,
  allWords,
  onRerender,
}: {
  clip: ClipResult;
  allWords: Word[];
  onRerender: (start: number, end: number) => void;
}) {
  const [pStart, setPStart] = useState(clip.start);
  const [pEnd,   setPEnd]   = useState(clip.end);

  // Reset when the clip prop changes (after a re-render completes)
  const prevClipRef = useRef(clip);
  useEffect(() => {
    if (prevClipRef.current.start !== clip.start || prevClipRef.current.end !== clip.end) {
      setPStart(clip.start);
      setPEnd(clip.end);
      prevClipRef.current = clip;
    }
  }, [clip]);

  // Words in a ±CONTEXT_SECS window around the clip
  const visible = allWords.filter(
    (w) => w.end > clip.start - CONTEXT_SECS && w.start < clip.end + CONTEXT_SECS
  );

  function tapWord(w: Word) {
    const mid = (pStart + pEnd) / 2;
    if (w.start < mid) {
      // Adjusting start — can extend before clip or trim from start
      setPStart(Math.min(w.start, pEnd - 5));
    } else {
      // Adjusting end — can extend after clip or trim from end
      setPEnd(Math.max(w.end, pStart + 5));
    }
  }

  const changed   = Math.abs(pStart - clip.start) > 0.3 || Math.abs(pEnd - clip.end) > 0.3;
  const dur       = pEnd - pStart;
  const tooShort  = dur < 5;
  const tooLong   = dur > 420; // matches worker MAX_CLIP_SECONDS (7 min ceiling)

  return (
    <div className="rounded-lg border border-white/5 bg-black/30 p-3">
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-white/25">
          Tap words to adjust clip
        </span>
        <span className={`text-[11px] font-medium tabular-nums ${
          tooShort ? 'text-red-400' : tooLong ? 'text-yellow-400' : changed ? 'text-orange-400' : 'text-white/50'
        }`}>
          {fmt(pStart)} → {fmt(pEnd)} · {Math.round(dur)}s
        </span>
      </div>

      {/* Transcript words */}
      <div className="max-h-40 overflow-y-auto">
        <p className="text-[13px] leading-7">
          {visible.length === 0 ? (
            <span className="text-white/20">No transcript data</span>
          ) : visible.map((w, i) => {
            const inClip  = w.start >= pStart - 0.15 && w.end <= pEnd + 0.15;
            // Mark the boundary words for visual anchors
            const isStart = !inClip && w.start <= pStart && w.end > clip.start - CONTEXT_SECS;
            const isEnd   = !inClip && w.start >= pEnd   && w.end < clip.end + CONTEXT_SECS;
            return (
              <span
                key={i}
                onClick={() => tapWord(w)}
                className={[
                  'cursor-pointer rounded px-[2px] py-[1px] mr-[2px] select-none',
                  inClip
                    ? 'text-white font-semibold'
                    : 'text-white/35 active:text-white/70',
                ].join(' ')}
              >
                {/* Boundary markers */}
                {w.start <= pStart && w.end > pStart && (
                  <span className="mr-0.5 text-[9px] text-orange-500">▶</span>
                )}
                {w.word}
                {w.start < pEnd && w.end >= pEnd && (
                  <span className="ml-0.5 text-[9px] text-orange-500">◀</span>
                )}
              </span>
            );
          })}
        </p>
      </div>

      {/* Legend */}
      <div className="mt-2 flex gap-3 text-[10px] text-white/25">
        <span><span className="text-orange-500">▶</span> start</span>
        <span><span className="text-orange-500">◀</span> end</span>
        <span className="text-white/40">white = included</span>
        <span>tap outside to extend</span>
      </div>

      {/* Action */}
      {changed && (
        <button
          onClick={() => onRerender(pStart, pEnd)}
          disabled={tooShort || tooLong}
          className="mt-3 w-full rounded-md bg-orange-500 py-2 text-xs font-bold text-white hover:bg-orange-400 disabled:opacity-40 active:scale-[0.98]"
        >
          {tooShort  ? 'Too short (min 5s)' :
           tooLong   ? 'Too long (max 7 min)' :
           `↩ Re-render · ${Math.round(dur)}s`}
        </button>
      )}
    </div>
  );
}

// ─── Score breakdown ──────────────────────────────────────────────────────────

const DIMS: { key: keyof Breakdown; label: string }[] = [
  { key: 'hook',  label: 'Hook'  },
  { key: 'flow',  label: 'Flow'  },
  { key: 'value', label: 'Value' },
  { key: 'trend', label: 'Trend' },
];

function gradeColor(g: string) {
  if (g.startsWith('A')) return 'text-orange-400 bg-orange-500/15 border-orange-500/25';
  if (g.startsWith('B')) return 'text-white/70 bg-white/8 border-white/15';
  return 'text-white/35 bg-white/5 border-white/10';
}

function ScoreBreakdown({ breakdown }: { breakdown: Breakdown }) {
  const [active, setActive] = useState<keyof Breakdown | null>(null);

  return (
    <div className="mt-3">
      {/* Grade badges */}
      <div className="grid grid-cols-4 gap-1.5">
        {DIMS.map(({ key, label }) => {
          const dim = breakdown[key];
          const isOpen = active === key;
          return (
            <button
              key={key}
              onClick={() => setActive(isOpen ? null : key)}
              className={[
                'rounded-lg border px-2 py-1.5 text-center transition-colors',
                gradeColor(dim.grade),
                isOpen ? 'ring-1 ring-orange-500/40' : '',
              ].join(' ')}
            >
              <div className="text-[10px] font-medium text-white/40">{label}</div>
              <div className="text-sm font-black leading-tight">{dim.grade}</div>
            </button>
          );
        })}
      </div>

      {/* Expanded reason */}
      {active && (
        <div className="mt-2 rounded-lg border border-white/8 bg-black/30 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-400">
            {active.charAt(0).toUpperCase() + active.slice(1)} · {breakdown[active].grade}
          </span>
          <p className="mt-0.5 text-xs leading-relaxed text-white/60">
            {breakdown[active].reason}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Single clip card ─────────────────────────────────────────────────────────

function ClipCard({
  clip,
  allWords,
  onRerender,
}: {
  clip: ClipResult;
  allWords: Word[];
  onRerender: (start: number, end: number) => void;
}) {
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Thumbnail row */}
      <div className="flex gap-3 p-4">
        {clip.thumbnail_url ? (
          <img
            src={clip.thumbnail_url}
            alt="clip thumbnail"
            className="w-[72px] shrink-0 rounded-lg object-cover"
            style={{ aspectRatio: '9/16' }}
          />
        ) : (
          <div className="w-[72px] shrink-0 rounded-lg bg-white/5 flex items-center justify-center" style={{ aspectRatio: '9/16' }}>
            <svg className="h-5 w-5 text-white/15" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        )}

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="rounded-md bg-orange-500/20 px-2 py-0.5 text-xs font-semibold text-orange-400">
              #{clip.index}
            </span>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/50">
              {clip.score}/100
            </span>
            <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/40">
              {Math.round(clip.duration)}s
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2">
            {clip.title}
          </h3>
          <p className="mt-1 text-xs italic text-white/40 line-clamp-2">"{clip.hook}"</p>
        </div>
      </div>

      {/* Score breakdown */}
      {clip.breakdown && (
        <div className="px-4">
          <ScoreBreakdown breakdown={clip.breakdown} />
        </div>
      )}

      {/* Body */}
      <div className="px-4 pb-4">
        {clip.extending ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/10 py-3 text-xs text-orange-400">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-500/30 border-t-orange-400" />
            Re-rendering… usually 1–3 min
          </div>
        ) : (
          <>
            {clip.extend_error && (
              <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                Re-render failed: {clip.extend_error}
              </div>
            )}

            {/* Transcript extend toggle */}
            <button
              onClick={() => setShowTranscript(v => !v)}
              className="mb-3 flex w-full items-center justify-between rounded-lg border border-white/8 bg-black/20 px-3 py-2.5 text-xs text-white/50 hover:text-white/80 active:bg-white/5"
            >
              <span className="font-medium">✎ Adjust clip window</span>
              <span className="text-white/30">{showTranscript ? '▲' : '▼'}</span>
            </button>

            {showTranscript && (
              <div className="mb-3">
                {allWords.length > 0 ? (
                  <TranscriptPanel
                    clip={clip}
                    allWords={allWords}
                    onRerender={onRerender}
                  />
                ) : (
                  <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-3 text-xs text-white/30 text-center">
                    Transcript not available for this job — re-run the video to enable adjustment
                  </div>
                )}
              </div>
            )}

            {/* Download */}
            <a
              href={clip.url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 active:scale-[0.98]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download clip
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const jobId        = searchParams.get('jobId');
  const [job,   setJob]   = useState<JobStatus | null>(null);
  const [error, setError] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const startPolling = useCallback(() => {
    if (intervalRef.current || !jobId) return;
    async function poll() {
      try {
        const res  = await fetch(`/api/job/${jobId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        setJob(data);
        const busy =
          data.status === 'queued' || data.status === 'running' ||
          (data.clips || []).some((c: ClipResult) => c.extending);
        if (!busy) stopPolling();
      } catch (err: any) {
        setError(err.message);
        stopPolling();
      }
    }
    poll();
    intervalRef.current = setInterval(poll, 3000);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) { router.replace('/'); return; }
    startPolling();
    return stopPolling;
  }, [jobId, startPolling, router]);

  // Extract all words from the stored transcript (new-style { segments, words })
  const allWords: Word[] = (() => {
    const seg = job?.segments;
    if (!seg) return [];
    if (Array.isArray(seg)) return []; // old-style segments array, no words
    return (seg.words || []) as Word[];
  })();

  async function rerender(clip: ClipResult, start: number, end: number) {
    setError('');
    try {
      const res = await fetch('/api/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, clipIndex: clip.index, start, end }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to re-render');
      setJob(j => j && j.clips ? {
        ...j,
        clips: j.clips.map(c =>
          c.index === clip.index ? { ...c, extending: true, extend_error: null } : c
        ),
      } : j);
      startPolling();
    } catch (err: any) { setError(err.message); }
  }

  const isProcessing = !job || job.status === 'queued' || job.status === 'running';

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-10">
      <div className="mx-auto max-w-xl">
        {/* Nav */}
        <div className="mb-8 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-xs text-white/30 hover:text-white/60">
            ← New video
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-white">Clippy</span>
            <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">AI</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
        )}

        {/* Processing spinner */}
        {isProcessing && !error && (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
            <p className="text-sm text-white/40">
              {!job           ? 'Connecting...'         :
               job.step === 'downloading'  ? 'Downloading video...'  :
               job.step === 'transcribing' ? 'Transcribing audio...' :
               job.step === 'scoring'      ? 'Finding best moments...' :
               job.step === 'cutting'      ? 'Cutting clips...'      :
               job.step === 'uploading'    ? 'Uploading...'          : 'Processing...'}
            </p>
            <p className="mt-1 text-xs text-white/20">This takes 2–4 minutes</p>
          </div>
        )}

        {/* Failed */}
        {job?.status === 'failed' && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm font-medium text-red-400">Processing failed</p>
            <p className="mt-1 text-xs text-red-400/70">{job.error}</p>
          </div>
        )}

        {/* Done */}
        {job?.status === 'done' && job.clips && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">{job.clips.length} clips ready</h2>
              <span className="text-xs text-white/30">Sorted by score</span>
            </div>
            <div className="flex flex-col gap-4">
              {[...job.clips]
                .sort((a, b) => b.score - a.score)
                .map((clip) => (
                  <ClipCard
                    key={clip.index}
                    clip={clip}
                    allWords={allWords}
                    onRerender={(start, end) => rerender(clip, start, end)}
                  />
                ))}
            </div>
            <button
              onClick={() => router.push('/')}
              className="mt-6 flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60 hover:text-white"
            >
              Process another video
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
      </main>
    }>
      <DashboardInner />
    </Suspense>
  );
}
