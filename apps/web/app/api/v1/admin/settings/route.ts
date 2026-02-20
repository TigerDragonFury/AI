import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestUser } from '@/lib/request-auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

async function assertAdmin(userId: string): Promise<boolean> {
  const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: { user } } = await adminClient.auth.admin.getUserById(userId);
  return user?.user_metadata?.role === 'admin';
}

// GET /api/v1/admin/settings — read all AI settings (secrets masked)
export async function GET(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  if (!(await assertAdmin(auth.auth.userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('ai_settings').select('key, value, is_secret, updated_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    (data ?? []).map((row) => ({
      key:       row.key,
      value:     row.is_secret && row.value ? '••••••••' : row.value,
      isSecret:  row.is_secret,
      updatedAt: row.updated_at,
    }))
  );
}

const updateSchema = z.record(z.string(), z.string().nullable());

// PUT /api/v1/admin/settings — bulk upsert settings
export async function PUT(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  if (!(await assertAdmin(auth.auth.userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = updateSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: body.error.issues.map(i => i.message).join(', ') }, { status: 422 });

  const supabase = getSupabaseServerClient();
  const rows = Object.entries(body.data).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('ai_settings').upsert(rows, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: rows.length });
}
