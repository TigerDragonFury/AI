import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestUser } from '@/lib/request-auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
});

// GET /api/v1/teams — list teams the user belongs to
export async function GET(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('team_members')
    .select('role, teams(id, name, slug, owner_id, created_at)')
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.map((row) => ({ ...row.teams, myRole: row.role })));
}

// POST /api/v1/teams — create a team
export async function POST(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;

  const body = createSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: body.error.issues.map(i => i.message).join(', ') }, { status: 422 });

  const slug = body.data.slug ?? body.data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const supabase = getSupabaseServerClient();

  // Create team
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({ owner_id: userId, name: body.data.name, slug })
    .select()
    .single();

  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });

  // Add owner as member
  await supabase.from('team_members').insert({ team_id: team.id, user_id: userId, role: 'owner' });

  return NextResponse.json(team, { status: 201 });
}
