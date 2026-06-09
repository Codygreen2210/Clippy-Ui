const WORKER_URL = process.env.WORKER_URL!;
const WORKER_API_KEY = process.env.WORKER_API_KEY!;

export interface ClipResult {
  index: number;
  title: string;
  hook: string;
  score: number;
  start: number;
  end: number;
  duration: number;
  url: string;
}

export interface JobStatus {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  step?: string;
  url: string;
  clips: ClipResult[] | null;
  error: string | null;
  createdAt: number;
}

export async function startJob(
  url: string,
  options?: { maxClips?: number; minDuration?: number; maxDuration?: number }
): Promise<{ jobId: string; status: string }> {
  const res = await fetch(`${WORKER_URL}/job`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': WORKER_API_KEY,
    },
    body: JSON.stringify({ url, options }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Worker error: ${res.status}`);
  }

  return res.json();
}

export async function getJob(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${WORKER_URL}/job/${jobId}`, {
    headers: { 'x-api-key': WORKER_API_KEY },
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Worker error: ${res.status}`);
  }

  return res.json();
}
