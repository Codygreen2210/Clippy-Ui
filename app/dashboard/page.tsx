'use client';

import { Suspense } from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface ClipResult {
  index: number;
  title: string;
  hook: string;
  score: number;
  start: number;
  end: number;
  duration: number;
  url: string;
  extending?: boolean;
  extend_error?: string | null;
}

interface JobStatus {
  id: string;
  status: string;
  step?: string;
  clips: ClipResult[] | null;
  error: string | null;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function DashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('jobId');
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState('');
  // Pending start/end deltas per clip index, in seconds
  const [adj, setAdj] = useState<Record<number, { s: number; e: number }>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const startPolling = useCallback(() => {
    if (intervalRef.current || !jobId) return;

    async function poll() {
      try {
        const res = await fetch(`/api/job/${jobId}`);
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

  async function rerender(clip: ClipResult) {
    const d = adj[clip.index] || { s: 0, e: 0 };
    const start = Math.max(0, clip.start + d.s);
    const end = clip.end + d.e;
    try {
      const res = await fetch('/api/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, clipIndex: clip.index, start, end }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to re-render');
      // Optimistically mark as extending so the spinner shows immediately
      setJob(j => j && j.clips ? {
        ...j,
        clips: j.clips.map(c => c.index === clip.index ? { ...c, extending: true, extend_error: null } : c),
      } : j);
      setAdj(a => ({ ...a, [clip.index]: { s: 0, e: 0 } }));
      startPolling();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function bump(index: number, edge: 's' | 'e', delta: number) {
    setAdj(a => {
      const cur = a[index] || { s: 0, e: 0 };
      return { ...a, [index]: { ...cur, [edge]: cur[edge] + delta } };
    });
  }

  const isProcessing = !job || job.status === 'queued' || job.status === 'running';

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center justify-between">
          <button onClick={() => router.push('/')}
            className="text-xs text-white/30 hover:text-white/60">
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

        {isProcessing && !error && (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
            <p className="text-sm text-white/40">
              {!job ? 'Connecting...' :
               job.step === 'downloading' ? 'Downloading video...' :
               job.step === 'transcribing' ? 'Transcribing audio...' :
               job.step === 'scoring' ? 'Finding best moments...' :
               job.step === 'cutting' ? 'Cutting clips...' :
               job.step === 'uploading' ? 'Uploading...' : 'Processing...'}
            </p>
            <p className="mt-1 text-xs text-white/20">This takes 2–4 minutes</p>
          </div>
        )}

        {job?.status === 'failed' && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm font-medium text-red-400">Processing failed</p>
            <p className="mt-1 text-xs text-red-400/70">{job.error}</p>
          </div>
        )}

        {job?.status === 'done' && job.clips && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">{job.clips.length} clips ready</h2>
              <span className="text-xs text-white/30">Sorted by score</span>
            </div>
            <div className="flex flex-col gap-3">
              {[...job.clips].sort((a, b) => b.score - a.score).map((clip) => {
                const d = adj[clip.index] || { s: 0, e: 0 };
                const newStart = Math.max(0, clip.start + d.s);
                const newEnd = clip.end + d.e;
                const newDur = newEnd - newStart;
                const changed = d.s !== 0 || d.e !== 0;
                const tooShort = newDur < 5;

                return (
                  <div key={clip.index} className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <span className="rounded-md bg-orange-500/20 px-2 py-0.5 text-xs font-semibold text-orange-400">#{clip.index}</span>
                          <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/50">Score {clip.score}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-white">{clip.title}</h3>
                      </div>
                      <span className="shrink-0 rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-white/60">
                        {Math.round(clip.duration)}s
                      </span>
                    </div>
                    <p className="mb-4 text-xs italic text-white/50">"{clip.hook}"</p>

                    {clip.extending ? (
                      <div className="flex items-center justify-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/10 py-3 text-xs text-orange-400">
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-500/30 border-t-orange-400" />
                        Re-rendering... usually 1–3 min
                      </div>
                    ) : (
                      <>
                        {clip.extend_error && (
                          <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                            Re-render failed: {clip.extend_error}
                          </div>
                        )}

                        {/* Adjust controls */}
                        <div className="mb-3 rounded-lg border border-white/5 bg-black/20 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wide text-white/30">Adjust clip</span>
                            <span className={`text-[11px] font-medium ${tooShort ? 'text-red-400' : 'text-white/50'}`}>
                              {fmt(newStart)} → {fmt(newEnd)} ({Math.round(newDur)}s)
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-white/30">Start</span>
                              <button onClick={() => bump(clip.index, 's', -5)}
                                className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white/70 active:bg-white/20">−5s</button>
                              <button onClick={() => bump(clip.index, 's', 5)}
                                className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white/70 active:bg-white/20">+5s</button>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-white/30">End</span>
                              <button onClick={() => bump(clip.index, 'e', -5)}
                                className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white/70 active:bg-white/20">−5s</button>
                              <button onClick={() => bump(clip.index, 'e', 5)}
                                className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white/70 active:bg-white/20">+5s</button>
                            </div>
                          </div>
                          {changed && (
                            <button onClick={() => rerender(clip)} disabled={tooShort}
                              className="mt-3 w-full rounded-md bg-orange-500/90 py-2 text-xs font-bold text-white hover:bg-orange-400 disabled:opacity-40">
                              {tooShort ? 'Too short (min 5s)' : 'Re-render clip'}
                            </button>
                          )}
                        </div>

                        <a href={clip.url} target="_blank" rel="noopener noreferrer" download
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400">
                          Download clip
                        </a>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => router.push('/')}
              className="mt-6 flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60 hover:text-white">
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
