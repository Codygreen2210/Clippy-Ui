import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/worker';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await getJob(params.id);
    return NextResponse.json(job);
  } catch (err: any) {
    console.error('[GET /api/job/[id]]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
