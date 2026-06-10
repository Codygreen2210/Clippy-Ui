import { NextRequest, NextResponse } from 'next/server';

// Frame extraction downloads part of the source video on the worker —
// can take well over Vercel's 10s default. Raise the function limit.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const WORKER_URL = process.env.WORKER_URL!;
const WORKER_API_KEY = process.env.WORKER_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const res = await fetch(`${WORKER_URL}/frame`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WORKER_API_KEY,
      },
      body: JSON.stringify({ url }),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || `Worker error: ${res.status}` },
        { status: res.status }
      );
    }

    // { frame: base64 jpeg, width, height }
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[POST /api/frame]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
