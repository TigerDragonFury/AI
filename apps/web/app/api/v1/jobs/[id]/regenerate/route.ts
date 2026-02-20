import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getJobById, updateJobStatus } from '../../../../../../lib/jobs-repository';
import { enqueueRegeneration } from '../../../../../../lib/queue-client';
import { requireRequestUser } from '../../../../../../lib/request-auth';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  const job = await updateJobStatus(id, 'processing', authResult.auth.userId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  let queueWarning: string | undefined;
  const hydratedJob = await getJobById(id, authResult.auth.userId);
  if (hydratedJob) {
    try {
      await enqueueRegeneration(hydratedJob);
    } catch {
      queueWarning = 'Status updated, but regeneration queue enqueue failed.';
    }
  }

  return NextResponse.json({ job, message: 'Regeneration queued', queueWarning });
}
