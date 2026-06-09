'use client';

const STEPS = ['downloading', 'transcribing', 'scoring', 'cutting', 'uploading', 'done'];

const STEP_LABELS: Record<string, string> = {
  downloading: 'Downloading',
  transcribing: 'Transcribing',
  scoring: 'Finding clips',
  cutting: 'Cutting & captioning',
  uploading: 'Uploading',
  done: 'Done',
};

interface StatusBarProps {
  status: string;
  step?: string;
  error?: string | null;
}

export default function StatusBar({ status, step, error }: StatusBarProps) {
  if (status === 'failed') {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-sm font-medium text-red-400">Processing failed</p>
        {error && <p className="mt-1 text-xs text-red-400/70">{error}</p>}
      </div>
    );
  }

  const currentIndex = step ? STEPS.indexOf(step) : -1;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-white/70">
          {step ? STEP_LABELS[step] || step : 'Starting...'}
        </span>
        {status !== 'done' && (
          <span className="flex items-center gap-1.5 text-xs text-white/40">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
            Processing
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        {STEPS.map((s, i) => {
          const isComplete = i < currentIndex || status === 'done';
          const isCurrent = s === step && status !== 'done';
          return (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                isComplete
                  ? 'bg-orange-500'
                  : isCurrent
                  ? 'animate-pulse bg-orange-400'
                  : 'bg-white/10'
              }`}
            />
          );
        })}
      </div>

      <div className="mt-3 flex justify-between">
        {STEPS.filter(s => s !== 'done').map((s) => (
          <span key={s} className="text-[10px] text-white/30">
            {STEP_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
