import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseServerClient } from '../../../../../lib/supabase-server';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return null;
  }
  return new Stripe(key);
}

/** Map Stripe price IDs → plan names */
function planFromPriceId(priceId: string): 'starter' | 'pro' | null {
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) {
    return 'starter';
  }
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
    return 'pro';
  }
  return null;
}

async function upsertSubscriptionByCustomer(
  customerId: string,
  updates: { plan?: string; status?: string; stripeSubscriptionId?: string }
) {
  const client = getSupabaseServerClient();
  if (!client) {
    return;
  }

  const { data: row } = await client
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!row?.user_id) {
    console.warn('[stripe-webhook] No user found for customer', customerId);
    return;
  }

  const patch: Record<string, unknown> = {};
  if (updates.plan) {
    patch.plan = updates.plan;
  }
  if (updates.status) {
    patch.status = updates.status;
  }
  if (updates.stripeSubscriptionId) {
    patch.stripe_subscription_id = updates.stripeSubscriptionId;
  }

  await client.from('user_subscriptions').update(patch).eq('user_id', row.user_id);
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured.' }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe-webhook] Signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // ── Credit top-up purchase ──────────────────────────────────────────
        if (session.metadata?.type === 'credit_purchase') {
          const targetUserId = session.metadata.userId;
          const creditAmount = parseFloat(session.metadata.creditAmount ?? '0');
          if (targetUserId && creditAmount > 0) {
            const client = getSupabaseServerClient();
            if (client) {
              // Use rpc or read-then-write for atomic credit increment
              const { data: row } = await client
                .from('user_subscriptions')
                .select('credit_balance')
                .eq('user_id', targetUserId)
                .single();
              const current = parseFloat(String(row?.credit_balance ?? 0));
              await client
                .from('user_subscriptions')
                .upsert({
                  user_id: targetUserId,
                  credit_balance: current + creditAmount,
                  plan: 'free',
                  status: 'trial',
                  credits: 0
                })
                .eq('user_id', targetUserId);
            }
          }
          break;
        }

        // ── Subscription checkout ───────────────────────────────────────────
        if (session.mode === 'subscription' && session.customer && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = sub.items.data[0]?.price.id ?? '';
          const plan = planFromPriceId(priceId) ?? 'starter';
          await upsertSubscriptionByCustomer(session.customer as string, {
            plan,
            status: sub.status === 'active' ? 'active' : 'trial',
            stripeSubscriptionId: sub.id
          });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const invoiceCustomer = invoice.customer as string | null;
        const invoiceSub = invoice.subscription;
        if (invoiceCustomer && invoiceSub) {
          const sub = await stripe.subscriptions.retrieve(
            typeof invoiceSub === 'string' ? invoiceSub : invoiceSub.id
          );
          const priceId = sub.items.data[0]?.price.id ?? '';
          const plan = planFromPriceId(priceId) ?? 'starter';
          await upsertSubscriptionByCustomer(invoiceCustomer, {
            plan,
            status: 'active',
            stripeSubscriptionId: sub.id
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id ?? '';
        const plan = planFromPriceId(priceId);
        const statusMap: Record<string, string> = {
          active: 'active',
          past_due: 'past_due',
          canceled: 'canceled',
          trialing: 'trial'
        };
        await upsertSubscriptionByCustomer(sub.customer as string, {
          plan: plan ?? undefined,
          status: statusMap[sub.status] ?? 'active',
          stripeSubscriptionId: sub.id
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscriptionByCustomer(sub.customer as string, {
          plan: 'free',
          status: 'canceled'
        });
        break;
      }

      default:
        // Unhandled event type — acknowledged but ignored
        break;
    }
  } catch (err) {
    console.error('[stripe-webhook] Handler error:', err);
    return NextResponse.json({ error: 'Webhook handler error.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
