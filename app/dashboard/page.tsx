'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Box { x: number; y: number; w: number; h: number }

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [maxClips, setMaxClips] = useState(3);
  const [loading, setLoading] = useState(false);
  const [loadingFrame, setLoadingFrame] = useState(false);
  const [error, setError] = useState('');
  const [frame, setFrame] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 1920, h: 1080 });
  const [box, setBox] = useState<Box | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  async function fetchFrame() {
    if (!url.trim()) return;
    setLoadingFrame(true);
    setError('');
    setBox(null);
    setFrame(null);
    try {
      const res = await fetch('/api/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load frame');
      setFrame(`data:image/jpeg;base64,${data.frame}`);
      setFrameSize({ w: data.width, h: data.height });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingFrame(false);
    }
  }

  function getPos(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  function onMouseDown(e: React.MouseEvent) {
    if (!frame) return;
    const pos = getPos(e);
    if (box) {
      const bx = Math.min(box.x, box.x + box.w);
      const by = Math.min(box.y, box.y + box.h);
      const bw = Math.abs(box.w);
      const bh = Math.abs(box.h);
      if (pos.x >= bx && pos.x <= bx + bw && pos.y >= by && pos.y <= by + bh) {
        setDragging(true);
        setDragStart({ x: pos.x - bx, y: pos.y - by });
        return;
      }
    }
    setDrawing(true);
    setBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
  }

  function onMouseMove(e: React.MouseEvent) {
    const pos = getPos(e);
    if (drawing && box) setBox(b => b ? { ...b, w: pos.x - b.x, h: pos.y - b.y } : b);
    if (dragging && box) {
      const bw = Math.abs(box.w); const bh = Math.abs(box.h);
      setBox(b => b ? { ...b, x: Math.max(0, Math.min(1 - bw, pos.x - dragStart.x)), y: Math.max(0, Math.min(1 - bh, pos.y - dragStart.y)) } : b);
    }
  }

  function onMouseUp() { setDrawing(false); setDragging(false); }

  async function handleSubmit() {
    if (!url.trim()) return;
    setError(''); setLoading(true);
    try {
      const faceCamBox = box && Math.abs(box.w) > 0.01 && Math.abs(box.h) > 0.01 ? {
        x: Math.round(Math.min(box.x, box.x + box.w) * frameSize.w),
        y: Math.round(Math.min(box.y, box.y + box.h) * frameSize.h),
        w: Math.round(Math.abs(box.w) * frameSize.w),
        h: Math.round(Math.abs(box.h) * frameSize.h),
        video_w: frameSize.w, video_h: frameSize.h,
      } : null;
      const res = await fetch('/api/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), options: { maxClips, faceCamBox } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start job');
      router.push(`/dashboard?jobId=${data.jobId}`);
    } catch (err: any) { setError(err.message); setLoading(false); }
  }

  const hasBox = box && Math.abs(box.w) > 0.01 && Math.abs(box.h) > 0.01;

  return (
    <main className="min-h-screen bg-[#0D0D0D] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-orange-500 flex items-center justify-center">
            <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <span className="font-bold text-white text-lg">Clippy</span>
        </div>
        <span className="rounded-full bg-orange-500/10 border border-orange-500/20 px-3 py-1 text-xs font-medium text-orange-400">Beta</span>
      </nav>

      {/* Hero */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-2 rounded-full bg-orange-500/10 border border-orange-500/20 px-4 py-1.5 text-xs font-medium text-orange-400">
          AI-Powered Video Clipping
        </div>
        <h1 className="mt-4 mb-3 text-center text-3xl font-black text-white leading-tight">
          Turn long videos into<br />viral short clips
        </h1>
        <p className="mb-10 text-center text-sm text-white/40 max-w-sm">
          Paste any video URL. AI finds the best moments, adds captions, and exports ready-to-post clips.
        </p>

        {/* Main card */}
        <div className="w-full max-w-lg">
          {/* URL input */}
          <div className="mb-3 flex gap-2">
            <input
              type="url" value={url}
              onChange={e => { setUrl(e.target.value); setFrame(null); setBox(null); }}
              onKeyDown={e => e.key === 'Enter' && (frame ? handleSubmit() : fetchFrame())}
              placeholder="Paste YouTube, TikTok, or video URL..."
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/25 outline-none focus:border-orange-500/50 focus:bg-white/[0.07]"
            />
            {!frame && (
              <button onClick={fetchFrame} disabled={loadingFrame || !url.trim()}
                className="rounded-xl bg-white/10 px-4 text-xs font-semibold text-white/70 hover:bg-white/20 disabled:opacity-40 whitespace-nowrap">
                {loadingFrame ? '...' : 'Preview'}
              </button>
            )}
          </div>

          {/* Frame calibration */}
          {loadingFrame && (
            <div className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 py-10 text-xs text-white/30">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
              Loading first frame...
            </div>
          )}

          {frame && (
            <div className="mb-3 rounded-xl border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/5">
                <span className="text-xs text-white/50">
                  {hasBox ? '✓ Face cam selected' : 'Draw a box over the face cam (optional)'}
                </span>
                <div className="flex gap-2">
                  {hasBox && <button onClick={() => setBox(null)} className="text-[10px] text-white/30 hover:text-white/60">Clear</button>}
                  <button onClick={() => { setFrame(null); setBox(null); }} className="text-[10px] text-white/30 hover:text-white/60">Remove</button>
                </div>
              </div>
              <div
                ref={canvasRef}
                className="relative w-full cursor-crosshair select-none"
                style={{ aspectRatio: `${frameSize.w}/${frameSize.h}` }}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove}
                onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
              >
                <img src={frame} alt="frame" className="w-full h-full object-cover pointer-events-none" draggable={false} />
                {box && Math.abs(box.w) > 0.005 && Math.abs(box.h) > 0.005 && (
                  <div className="absolute border-2 border-orange-500 bg-orange-500/15 cursor-move"
                    style={{
                      left: `${Math.min(box.x, box.x + box.w) * 100}%`,
                      top: `${Math.min(box.y, box.y + box.h) * 100}%`,
                      width: `${Math.abs(box.w) * 100}%`,
                      height: `${Math.abs(box.h) * 100}%`,
                    }}>
                    <div className="absolute -top-5 left-0 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">Face cam</div>
                    <div className="absolute bottom-0 right-0 h-3 w-3 bg-orange-500 cursor-se-resize" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings row */}
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-xs text-white/40 shrink-0">Clips:</span>
            <input type="range" min={1} max={5} value={maxClips}
              onChange={e => setMaxClips(Number(e.target.value))}
              className="flex-1 accent-orange-500" />
            <span className="text-xs font-bold text-orange-400 w-4 text-center">{maxClips}</span>
          </div>

          {error && (
            <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">{error}</div>
          )}

          <button onClick={handleSubmit} disabled={loading || !url.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-4 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-40 active:scale-[0.98] transition-all">
            {loading
              ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Processing...</>
              : <><svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Get clips</>
            }
          </button>

          <p className="mt-3 text-center text-[10px] text-white/20">
            YouTube · TikTok · Instagram · X · Vimeo
          </p>
        </div>
      </div>
    </main>
  );
}
