'use client';

import { Suspense } from 'react';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { JobStatus } from '@/lib/worker';
import StatusBar from '@/components/StatusBar';
import ClipCard from '@/components/ClipCard';

const POLL_INTERVAL = 3000;

function DashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('jobId');

  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!jobId) {
      router.replace('/');
      return;
    }

    async function poll() {
      try {
        const res = await fetch(`/api/job/${jobId}`);
        const data: JobStatus = await res.json();
        if (!res.ok) throw new Error((data as any).error || 'Failed to fetch job');
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
    intervalRef.current = setInterval(poll, POLL_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [jobId]);

  const isProcessing = !job || job.status === 'queued' || job.status === 'running';

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-xs text-white/30 transition-colors hover:text-white/60"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            New video
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-white">Clippy</span>
            <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">AI</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {job && (
          <div className="mb-6">
            <StatusBar status={job.status} step={job.step} error={job.error} />
          </div>
        )}

        {isProcessing && !error && (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
            <p className="text-sm text-white/40">
              {!job ? 'Connecting...' :
               job.step === 'downloading' ? 'Downloading video...' :
               job.step === 'transcribing' ? 'Transcribing with Whisper...' :
               job.step === 'scoring' ? 'AI is finding the best moments...' :
               job.step === 'cutting' ? 'Cutting clips and burning captions...' :
               job.step === 'uploading' ? 'Uploading to cloud...' :
               'Processing...'}
            </p>
            <p className="mt-1 text-xs text-white/20">This takes 2–4 minutes</p>
          </div>
        )}

        {job?.status === 'done' && job.clips && job.clips.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                {job.clips.length} clip{job.clips.length !== 1 ? 's' : ''} ready
              </h2>
              <span className="text-xs text-white/30">Sorted by score</span>
            </div>
            <div className="flex flex-col gap-3">
              {job.clips.sort((a, b) => b.score - a.score).map((clip) => (
                <ClipCard key={clip.index} clip={clip} />
              ))}
            </div>
            <button
              onClick={() => router.push('/')}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60 transition-all hover:border-white/20 hover:text-white"
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
