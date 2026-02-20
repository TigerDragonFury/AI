import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { requireRequestUser } from '../../../../../lib/request-auth';
import { getSupabaseServerClient } from '../../../../../lib/supabase-server';

const CREDIT_AMOUNTS = [10, 25, 50, 100, 250] as const;

const bodySchema = z.object({
  amount: z.number().positive()
});

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

/** Ensure (or get) the Stripe customer ID for this user. */
async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const db = getSupabaseServerClient();
  if (!db) return null;

  const { data: row } = await db
    .from('user_subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (row?.stripe_customer_id) return row.stripe_customer_id as string;

  const customer = await stripe.customers.create({ email, metadata: { userId } });

  await db
    .from('user_subscriptions')
    .upsert({ user_id: userId, stripe_customer_id: customer.id, plan: 'free', status: 'trial', credits: 0 })
    .eq('user_id', userId);

  return customer.id;
}

/**
 * GET  /api/v1/billing/credits
 *   Returns the current credit balance.
 *
 * POST /api/v1/billing/credits
 *   Body: { amount: number } — top-up amount in USD.
 *   Returns: { url: string } — Stripe Checkout URL.
 */

export async function GET(request: Request) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult.auth;

  const db = getSupabaseServerClient();
  if (!db) {
    return NextResponse.json({ creditBalance: 0 });
  }

  const { data } = await db
    .from('user_subscriptions')
    .select('credit_balance')
    .eq('user_id', userId)
    .single();

  return NextResponse.json({ creditBalance: Number(data?.credit_balance ?? 0) });
}

export async function POST(request: Request) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult.auth;

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured.' }, { status: 503 });
  }

  let body: { amount: number };
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { amount } = body;
  if (!CREDIT_AMOUNTS.includes(amount as (typeof CREDIT_AMOUNTS)[number]) && amount > 0) {
    // Allow any positive amount, CREDIT_AMOUNTS are just suggested options
  }

  // Resolve user email for Stripe
  const db = getSupabaseServerClient();
  let email = 'user@example.com';
  if (db) {
    const { data: user } = await db.auth.admin.getUserById(userId);
    email = user?.user?.email ?? email;
  }

  const customerId = await getOrCreateStripeCustomer(userId, email);
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId ?? undefined,
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `Ad Credit Top-Up — $${amount}`,
            description: `${amount} USD added to your ad spend credit balance.`
          }
        }
      }
    ],
    metadata: {
      type: 'credit_purchase',
      userId,
      creditAmount: String(amount)
    },
    success_url: `${appUrl}?billing=credit-success&amount=${amount}`,
    cancel_url: `${appUrl}?billing=credit-cancel`
  });

  return NextResponse.json({ url: session.url });
}
