import { NextRequest, NextResponse } from 'next/server';
import { startJob } from '@/lib/worker';

export async function POST(req: NextRequest) {
  try {
    const { url, options } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const result = await startJob(url, options);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[POST /api/job]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
