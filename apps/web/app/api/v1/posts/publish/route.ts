import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { addPublishedPost } from '../../../../../lib/platform-store';
import { updateJobStatus } from '../../../../../lib/jobs-repository';
import { requireRequestUser } from '../../../../../lib/request-auth';
import { sendJobPublishedEmail } from '../../../../../lib/email';
import { enqueueScheduledPublish } from '../../../../../lib/queue-client';

const schema = z.object({
  jobId: z.string().min(1),
  platforms: z.array(z.string().min(1)).min(1),
  scheduleAt: z.string().datetime().optional()
});

export async function POST(request: Request) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const json = await request.json();
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, { status: 400 });
  }

  const post = await addPublishedPost({
    userId: authResult.auth.userId,
    jobId: parsed.data.jobId,
    platforms: parsed.data.platforms,
    scheduleAt: parsed.data.scheduleAt,
    status: parsed.data.scheduleAt ? 'scheduled' : 'published'
  });

  await updateJobStatus(
    parsed.data.jobId,
    parsed.data.scheduleAt ? 'approved' : 'published',
    authResult.auth.userId
  );

  // If scheduled, enqueue a delayed worker job to publish at the right time
  if (parsed.data.scheduleAt) {
    try {
      await enqueueScheduledPublish({
        userId: authResult.auth.userId,
        jobId: parsed.data.jobId,
        platforms: parsed.data.platforms,
        scheduleAt: parsed.data.scheduleAt
      });
    } catch {
      // Non-critical — post is saved, queue may be unavailable
    }
  }

  // Fire-and-forget email notification
  if (!parsed.data.scheduleAt) {
    sendJobPublishedEmail(authResult.auth.email, parsed.data.jobId, parsed.data.platforms).catch(() => {
      // non-critical
    });
  }

  return NextResponse.json({ post }, { status: 201 });
}
