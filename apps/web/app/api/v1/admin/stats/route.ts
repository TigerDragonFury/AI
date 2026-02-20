import { NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/request-auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

async function assertAdmin(userId: string): Promise<boolean> {
  const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: { user } } = await adminClient.auth.admin.getUserById(userId);
  return user?.user_metadata?.role === 'admin';
}

// GET /api/v1/admin/stats — platform-wide statistics
export async function GET(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  if (!(await assertAdmin(auth.auth.userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const supabase = getSupabaseServerClient();

  const [
    { data: { users } },
    { count: totalChats },
    { count: totalImages },
    { count: totalTts },
    { count: totalContent },
    { data: usageLogs },
  ] = await Promise.all([
    adminClient.auth.admin.listUsers({ page: 1, perPage: 1 }),
    supabase.from('ai_chats').select('*', { count: 'exact', head: true }),
    supabase.from('generated_images').select('*', { count: 'exact', head: true }),
    supabase.from('generated_tts').select('*', { count: 'exact', head: true }),
    supabase.from('generated_content').select('*', { count: 'exact', head: true }),
    supabase.from('usage_logs').select('credits_used').gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString()),
  ]);

  const creditsLast30Days = (usageLogs ?? []).reduce((sum, r) => sum + parseFloat(String(r.credits_used ?? 0)), 0);

  return NextResponse.json({
    totalUsers:     users.length,
    totalChats:     totalChats ?? 0,
    totalImages:    totalImages ?? 0,
    totalTts:       totalTts ?? 0,
    totalContent:   totalContent ?? 0,
    creditsLast30d: creditsLast30Days,
  });
}
