import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { createJobSchema } from '@packages/shared';
import { createJob, updateJobCaption } from '../../../../../lib/jobs-repository';
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
  const { productDescription, tone, targetPlatforms, personSourceName } = parsed.data;
  const platformList = (targetPlatforms ?? []).join(', ') || 'social media';
  const toneStr = tone ?? 'engaging';
  const subject = productDescription || personSourceName || 'the product';

  let caption = '';

  if (geminiKey) {
    try {
      caption = await complete({
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
    } catch (aiErr) {
      console.error('[AI caption] Generation failed:', aiErr);
      queueWarning = 'AI caption generation failed — you can edit the caption manually.';
    }
  } else {
    queueWarning = 'GEMINI_API_KEY not set — caption left blank for manual editing.';
  }

  // Always move to awaiting_approval so the preview modal opens (never leave stuck in queued/processing)
  const finalCaption = caption.trim() || subject;
  await updateJobCaption(job.id, authResult.auth.userId, finalCaption);
  job.caption = finalCaption;
  job.status = 'awaiting_approval';

  return NextResponse.json({ status: 'awaiting_approval', job, queueWarning }, { status: 201 });
}
