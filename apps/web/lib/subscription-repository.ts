import { getSupabaseServerClient, isSupabaseConfigured } from './supabase-server';

export type PlanType = 'free' | 'starter' | 'pro';

export type SubscriptionSnapshot = {
  plan: PlanType;
  status: 'trial' | 'active' | 'past_due' | 'canceled';
  credits: number;
  creditBalance: number;
  quota: {
    limit: number | null;
    used: number;
    remaining: number | null;
  };
};

const limitsByPlan: Record<PlanType, number | null> = {
  free: 3,
  starter: 20,
  pro: null
};

const memorySubscriptions = new Map<
  string,
  { plan: PlanType; status: SubscriptionSnapshot['status']; credits: number; creditBalance: number }
>();

function defaultSubscription() {
  return { plan: 'free' as PlanType, status: 'trial' as const, credits: 0, creditBalance: 0 };
}

async function countUserJobs(userId: string) {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return 0;
  }

  const { count } = await client
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  return count ?? 0;
}

async function ensureSupabaseSubscriptionRow(userId: string) {
  const client = getSupabaseServerClient();
  if (!client) {
    return null;
  }

  const { data: existing } = await client
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) {
    return existing;
  }

  const { data: inserted } = await client
    .from('user_subscriptions')
    .insert({ user_id: userId, plan: 'free', status: 'trial', credits: 0 })
    .select('*')
    .single();

  return inserted ?? null;
}

export async function getUserSubscription(userId: string): Promise<SubscriptionSnapshot> {
  if (!isSupabaseConfigured()) {
    const memory = memorySubscriptions.get(userId) ?? defaultSubscription();
    memorySubscriptions.set(userId, memory);

    const limit = limitsByPlan[memory.plan];
    return {
      plan: memory.plan,
      status: memory.status,
      credits: memory.credits,
      creditBalance: memory.creditBalance,
      quota: {
        limit,
        used: 0,
        remaining: limit === null ? null : Math.max(limit, 0)
      }
    };
  }

  const row = await ensureSupabaseSubscriptionRow(userId);
  const used = await countUserJobs(userId);

  const plan = (row?.plan as PlanType | undefined) ?? 'free';
  const status =
    (row?.status as SubscriptionSnapshot['status'] | undefined) ??
    ('trial' as SubscriptionSnapshot['status']);
  const credits = Number(row?.credits ?? 0);
  const creditBalance = parseFloat(String(row?.credit_balance ?? 0));
  const limit = limitsByPlan[plan] ?? 3;
  const remaining = limit === null ? null : Math.max(limit - used, 0);

  return {
    plan,
    status,
    credits,
    creditBalance,
    quota: {
      limit,
      used,
      remaining
    }
  };
}

export async function deductCredits(userId: string, amount: number): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const memory = memorySubscriptions.get(userId) ?? defaultSubscription();
    if (memory.creditBalance < amount) return false;
    memory.creditBalance -= amount;
    memorySubscriptions.set(userId, memory);
    return true;
  }

  const client = getSupabaseServerClient();
  if (!client) return false;

  const { data: row } = await client
    .from('user_subscriptions')
    .select('credit_balance')
    .eq('user_id', userId)
    .single();

  const current = parseFloat(String(row?.credit_balance ?? 0));
  if (current < amount) return false;

  await client
    .from('user_subscriptions')
    .update({ credit_balance: current - amount })
    .eq('user_id', userId);

  return true;
}

export async function canCreateJob(userId: string) {
  const subscription = await getUserSubscription(userId);
  const blocked = subscription.quota.remaining !== null && subscription.quota.remaining <= 0;

  return {
    allowed: !blocked,
    subscription
  };
}
