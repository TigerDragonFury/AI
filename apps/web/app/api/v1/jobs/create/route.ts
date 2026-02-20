import { NextResponse } from 'next/server';
import { createJobSchema } from '@packages/shared';
import { createJob } from '../../../../../lib/jobs-repository';
import { enqueueNewJob } from '../../../../../lib/queue-client';
import { requireRequestUser } from '../../../../../lib/request-auth';
import { canCreateJob } from '../../../../../lib/subscription-repository';

export async function POST(request: Request) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const json = await request.json();
  const parsed = createJobSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, { status: 400 });
  }

  const quota = await canCreateJob(authResult.auth.userId);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: 'Ad quota reached for current plan. Upgrade to continue.',
        subscription: quota.subscription
      },
      { status: 402 }
    );
  }

  const job = await createJob(parsed.data, authResult.auth.userId);
  let queueWarning: string | undefined;

  try {
    await enqueueNewJob(job);
  } catch {
    queueWarning = 'Job created, but queue enqueue failed. Ensure REDIS_URL is reachable.';
  }

  return NextResponse.json({ status: 'queued', job, queueWarning }, { status: 201 });
}
