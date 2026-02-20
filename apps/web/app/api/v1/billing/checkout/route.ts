import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireRequestUser } from '../../../../../lib/request-auth';
import { getSupabaseServerClient } from '../../../../../lib/supabase-server';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return null;
  }
  return new Stripe(key);
}

async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) {
    return null;
  }

  const client = getSupabaseServerClient();
  if (client) {
    const { data } = await client
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (data?.stripe_customer_id) {
      return data.stripe_customer_id as string;
    }
  }

  const customer = await stripe.customers.create({ email, metadata: { userId } });

  if (client) {
    await client
      .from('user_subscriptions')
      .upsert({ user_id: userId, stripe_customer_id: customer.id }, { onConflict: 'user_id' });
  }

  return customer.id;
}

export async function GET(request: Request) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Billing not configured.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const priceId = searchParams.get('price') ?? process.env.STRIPE_STARTER_PRICE_ID ?? '';

  if (!priceId) {
    return NextResponse.json({ error: 'No price ID configured.' }, { status: 503 });
  }

  const email = authResult.auth.email ?? '';
  const customerId = await getOrCreateStripeCustomer(authResult.auth.userId, email);
  if (!customerId) {
    return NextResponse.json({ error: 'Could not resolve billing customer.' }, { status: 500 });
  }

  const origin = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?billing=success`,
    cancel_url: `${origin}/?billing=cancel`,
    metadata: { userId: authResult.auth.userId }
  });

  return NextResponse.redirect(session.url!);
}
