'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SUPPORTED = ['youtube.com', 'youtu.be', 'tiktok.com', 'instagram.com', 'twitter.com', 'x.com', 'vimeo.com'];

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [maxClips, setMaxClips] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!url.trim()) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), options: { maxClips } }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to start job');

      router.push(`/dashboard?jobId=${data.jobId}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-4">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <span className="text-3xl font-black tracking-tight text-white">Clippy</span>
          <span className="rounded-md bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">AI</span>
        </div>
        <p className="text-sm text-white/40">Paste a video URL. Get viral clips in minutes.</p>
      </div>

      {/* Input card */}
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6">
        {/* URL input */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-white/50">Video URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
          />
        </div>

        {/* Clip count */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-white/50">
            Number of clips: <span className="text-orange-400">{maxClips}</span>
          </label>
          <input
            type="range"
            min={1}
            max={5}
            value={maxClips}
            onChange={(e) => setMaxClips(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-white/20">
            <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !url.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
        >
          {loading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Starting...
            </>
          ) : (
            'Generate clips →'
          )}
        </button>

        {/* Supported platforms */}
        <p className="mt-4 text-center text-[10px] text-white/20">
          Works with YouTube, TikTok, Instagram, X, Vimeo
        </p>
      </div>
    </main>
  );
}
