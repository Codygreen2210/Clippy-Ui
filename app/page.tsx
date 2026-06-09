'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Box { x: number; y: number; w: number; h: number }

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [maxClips, setMaxClips] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Calibration state
  const [frame, setFrame] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 1920, h: 1080 });
  const [box, setBox] = useState<Box | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loadingFrame, setLoadingFrame] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

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

  function getRelativePos(e: React.MouseEvent | React.TouchEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }

  function onMouseDown(e: React.MouseEvent) {
    if (!frame) return;
    const pos = getRelativePos(e);
    if (box) {
      // Check if clicking inside box to drag
      if (pos.x >= box.x && pos.x <= box.x + box.w &&
          pos.y >= box.y && pos.y <= box.y + box.h) {
        setDragging(true);
        setDragStart({ x: pos.x - box.x, y: pos.y - box.y });
        return;
      }
    }
    // Start new box
    setDrawing(true);
    setBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!frame) return;
    const pos = getRelativePos(e);
    if (drawing && box) {
      setBox(b => b ? { ...b, w: pos.x - b.x, h: pos.y - b.y } : b);
    } else if (dragging && box) {
      setBox(b => b ? {
        ...b,
        x: Math.max(0, Math.min(1 - b.w, pos.x - dragStart.x)),
        y: Math.max(0, Math.min(1 - b.h, pos.y - dragStart.y)),
      } : b);
    }
  }

  function onMouseUp() {
    setDrawing(false);
    setDragging(false);
  }

  async function handleSubmit() {
    if (!url.trim()) return;
    setError('');
    setLoading(true);
    try {
      const faceCamBox = box && box.w > 0 && box.h > 0 ? {
        x: Math.round(Math.min(box.x, box.x + box.w) * frameSize.w),
        y: Math.round(Math.min(box.y, box.y + box.h) * frameSize.h),
        w: Math.round(Math.abs(box.w) * frameSize.w),
        h: Math.round(Math.abs(box.h) * frameSize.h),
        video_w: frameSize.w,
        video_h: frameSize.h,
      } : null;

      const res = await fetch('/api/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          options: { maxClips, faceCamBox },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start job');
      router.push(`/dashboard?jobId=${data.jobId}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  const showCalibration = frame !== null;
  const hasBox = box && Math.abs(box.w) > 0.01 && Math.abs(box.h) > 0.01;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <span className="text-3xl font-black tracking-tight text-white">Clippy</span>
          <span className="rounded-md bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">AI</span>
        </div>
        <p className="text-sm text-white/40">Paste a video URL. Get viral clips in minutes.</p>
      </div>

      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6">
        {/* URL input */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-white/50">Video URL</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setFrame(null); setBox(null); }}
              onKeyDown={(e) => e.key === 'Enter' && fetchFrame()}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-orange-500/50"
            />
            <button
              onClick={fetchFrame}
              disabled={loadingFrame || !url.trim()}
              className="rounded-lg bg-white/10 px-4 py-3 text-xs font-semibold text-white/70 transition-all hover:bg-white/20 disabled:opacity-40"
            >
              {loadingFrame ? '...' : 'Load'}
            </button>
          </div>
        </div>

        {/* Frame calibration */}
        {loadingFrame && (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-8 text-sm text-white/40">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
            Loading video frame...
          </div>
        )}

        {showCalibration && (
          <div className="mb-4">
            <p className="mb-2 text-xs text-white/50">
              {hasBox ? '✓ Face cam selected — drag to reposition' : 'Draw a box around the face cam'}
            </p>
            <div
              ref={canvasRef}
              className="relative w-full cursor-crosshair overflow-hidden rounded-lg border border-white/10 select-none"
              style={{ aspectRatio: `${frameSize.w}/${frameSize.h}` }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              <img
                ref={imgRef}
                src={frame!}
                alt="Video frame"
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
              />
              {box && Math.abs(box.w) > 0.005 && Math.abs(box.h) > 0.005 && (
                <div
                  className="absolute border-2 border-orange-500 bg-orange-500/20"
                  style={{
                    left: `${Math.min(box.x, box.x + box.w) * 100}%`,
                    top: `${Math.min(box.y, box.y + box.h) * 100}%`,
                    width: `${Math.abs(box.w) * 100}%`,
                    height: `${Math.abs(box.h) * 100}%`,
                  }}
                >
                  <div className="absolute -top-5 left-0 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white whitespace-nowrap">
                    Face cam
                  </div>
                </div>
              )}
              {!hasBox && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-lg bg-black/60 px-4 py-2 text-xs text-white/60">
                    Click and drag to select face cam area
                  </div>
                </div>
              )}
            </div>
            {hasBox && (
              <button
                onClick={() => setBox(null)}
                className="mt-1.5 text-xs text-white/30 hover:text-white/60"
              >
                Clear selection
              </button>
            )}
          </div>
        )}

        {/* Clip count */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-white/50">
            Number of clips: <span className="text-orange-400">{maxClips}</span>
          </label>
          <input
            type="range" min={1} max={5} value={maxClips}
            onChange={(e) => setMaxClips(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-white/20">
            <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !url.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
        >
          {loading ? (
            <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Starting...</>
          ) : (
            hasBox ? 'Generate clips with face cam →' : frame ? 'Generate clips (no face cam split) →' : 'Generate clips →'
          )}
        </button>

        <p className="mt-4 text-center text-[10px] text-white/20">
          Works with YouTube, TikTok, Instagram, X, Vimeo
        </p>
      </div>
    </main>
  );
}
