import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { addCampaign, getPublishedPostById } from '../../../../../../lib/platform-store';
import { enqueueAdsBoost } from '../../../../../../lib/queue-client';
import { requireRequestUser } from '../../../../../../lib/request-auth';
import { deductCredits, getUserSubscription } from '../../../../../../lib/subscription-repository';
import { sendEmail } from '../../../../../../lib/notifications';
import { getSupabaseServerClient } from '../../../../../../lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  budget: z.number().positive(),
  durationDays: z.number().int().positive(),
  objective: z.enum(['REACH', 'VIDEO_VIEWS'])
});

export async function POST(request: Request, { params }: Params) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  const json = await request.json();
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, { status: 400 });
  }

  const post = await getPublishedPostById(id, authResult.auth.userId);
  if (!post) {
    return NextResponse.json({ error: 'Published post not found for this user.' }, { status: 404 });
  }

  // Deduct ad spend credits (budget in USD)
  const deducted = await deductCredits(authResult.auth.userId, parsed.data.budget);
  if (!deducted) {
    return NextResponse.json(
      { error: `Insufficient credit balance. Top up at least $${parsed.data.budget} to run this campaign.` },
      { status: 402 }
    );
  }

  // Send low-balance alert if credit balance dropped below $10
  try {
    const sub = await getUserSubscription(authResult.auth.userId);
    if (sub.creditBalance < 10) {
      const db = getSupabaseServerClient();
      if (db) {
        const { data: user } = await db.auth.admin.getUserById(authResult.auth.userId);
        const email = user?.user?.email;
        if (email) {
          await sendEmail({
            to: email,
            subject: 'Low ad credit balance — AI Ad Platform',
            html: `<p>Your ad credit balance has dropped to <strong>$${sub.creditBalance.toFixed(2)}</strong>.</p>
                   <p><a href="${process.env.APP_URL ?? 'http://localhost:3000'}?section=Billing">Top up now</a> to keep your campaigns running.</p>`
          });
        }
      }
    }
  } catch {
    // Non-fatal: notification failure should not block the campaign
  }

  const campaign = await addCampaign({
    userId: authResult.auth.userId,
    postId: id,
    budget: parsed.data.budget,
    durationDays: parsed.data.durationDays,
    objective: parsed.data.objective
  });

  // Enqueue boost job for each platform
  try {
    for (const platform of post.platforms) {
      await enqueueAdsBoost({
        userId: authResult.auth.userId,
        postId: id,
        platform,
        budget: parsed.data.budget,
        durationDays: parsed.data.durationDays,
        objective: parsed.data.objective
      });
    }
  } catch (err) {
    console.warn('Boost queue enqueue failed:', err);
  }

  return NextResponse.json({ campaign }, { status: 201 });
}
