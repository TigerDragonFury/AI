import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { createJobSchema } from '@packages/shared';
import { createJob, updateJobCaption } from '../../../../../lib/jobs-repository';
import { enqueueNewJob } from '../../../../../lib/queue-client';
import { requireRequestUser } from '../../../../../lib/request-auth';
import { canCreateJob } from '../../../../../lib/subscription-repository';
import { complete } from '../../../../../lib/ai-engine';

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

  // ── Inline AI caption generation (no worker needed) ──────────────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const { productDescription, tone, targetPlatforms, personSourceName } = parsed.data;
      const platformList = (targetPlatforms ?? []).join(', ') || 'social media';
      const toneStr = tone ?? 'engaging';
      const subject = productDescription || personSourceName || 'the product';

      const caption = await complete({
        model: 'gemini-2.0-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert social media copywriter. Write short, punchy ad captions optimised for ${platformList}. Use a ${toneStr} tone. Output ONLY the caption text — no quotes, no explanation, no hashtags unless they add real value.`
          },
          {
            role: 'user',
            content: `Write an ad caption for: ${subject}`
          }
        ],
        maxTokens: 200,
        temperature: 0.8
      });

      if (caption.trim()) {
        await updateJobCaption(job.id, authResult.auth.userId, caption.trim());
        job.caption = caption.trim();
        job.status = 'awaiting_approval';
      }
    } catch (aiErr) {
      console.error('[AI caption] Generation failed:', aiErr);
      queueWarning = 'Job created but AI caption generation failed. Check GEMINI_API_KEY.';
    }
  } else {
    // Fall back to BullMQ worker if no Gemini key
    try {
      await enqueueNewJob(job);
    } catch {
      queueWarning = 'Job created, but queue enqueue failed. Ensure REDIS_URL is reachable.';
    }
  }

  return NextResponse.json({ status: 'queued', job, queueWarning }, { status: 201 });
}
