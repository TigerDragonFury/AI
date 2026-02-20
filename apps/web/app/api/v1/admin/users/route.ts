import { NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/request-auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/v1/admin/users — list all users (admin only)
export async function GET(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;

  // Admin guard: check if user has admin role in user_metadata
  const adminClient = getAdminClient();
  const { data: { user } } = await adminClient.auth.admin.getUserById(auth.auth.userId);
  if (user?.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1');
  const limit = 50;

  const { data: { users }, error } = await adminClient.auth.admin.listUsers({
    page,
    perPage: limit,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with subscription data
  const supabase = getSupabaseServerClient();
  const userIds = users.map((u) => u.id);
  const { data: subs } = await supabase
    .from('user_subscriptions')
    .select('user_id, plan, status, credit_balance')
    .in('user_id', userIds);

  const subMap = Object.fromEntries((subs ?? []).map((s) => [s.user_id, s]));

  return NextResponse.json(
    users.map((u) => ({
      id:           u.id,
      email:        u.email,
      name:         u.user_metadata?.full_name,
      role:         u.user_metadata?.role ?? 'user',
      createdAt:    u.created_at,
      lastSignIn:   u.last_sign_in_at,
      subscription: subMap[u.id] ?? null,
    }))
  );
}
