import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const WORKER_URL = process.env.WORKER_URL!;
const WORKER_API_KEY = process.env.WORKER_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { jobId, clipIndex, start, end } = await req.json();

    if (!jobId || typeof clipIndex !== 'number' || typeof start !== 'number' || typeof end !== 'number') {
      return NextResponse.json({ error: 'jobId, clipIndex, start, end are required' }, { status: 400 });
    }

    const res = await fetch(`${WORKER_URL}/extend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WORKER_API_KEY,
      },
      body: JSON.stringify({ jobId, clipIndex, start, end }),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data.error || `Worker error: ${res.status}` }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
