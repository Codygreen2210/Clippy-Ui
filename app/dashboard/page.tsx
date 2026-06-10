'use client';

import { Suspense } from 'react';
import { useEffect, useState, useRef } from 'react';
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
}

interface JobStatus {
  id: string;
  status: string;
  step?: string;
  clips: ClipResult[] | null;
  error: string | null;
}

function DashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('jobId');
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!jobId) { router.replace('/'); return; }

    async function poll() {
      try {
        const res = await fetch(`/api/job/${jobId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        setJob(data);
        if (data.status === 'done' || data.status === 'failed') {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch (err: any) {
        setError(err.message);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [jobId]);

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
              {job.clips.sort((a, b) => b.score - a.score).map((clip) => (
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
                  <a href={clip.url} target="_blank" rel="noopener noreferrer" download
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400">
                    Download clip
                  </a>
                </div>
              ))}
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
