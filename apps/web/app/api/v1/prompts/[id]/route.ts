import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestUser } from '@/lib/request-auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  prompt:      z.string().min(1).optional(),
  category:    z.string().optional(),
  tags:        z.array(z.string()).max(10).optional(),
  isPublic:    z.boolean().optional(),
});

// GET /api/v1/prompts/[id] — get single template
export async function GET(request: Request, { params }: Params) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;
  const { id } = await params;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('id', id)
    .or(`user_id.eq.${userId},is_public.eq.true`)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Increment use_count
  await supabase.from('prompt_templates').update({ use_count: (data.use_count ?? 0) + 1 }).eq('id', id);

  return NextResponse.json(data);
}

// PATCH /api/v1/prompts/[id] — update template (owner only)
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;
  const { id } = await params;

  const body = updateSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: body.error.issues.map(i => i.message).join(', ') }, { status: 422 });

  const supabase = getSupabaseServerClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.data.title !== undefined)       updates.title       = body.data.title;
  if (body.data.description !== undefined) updates.description = body.data.description;
  if (body.data.prompt !== undefined)      updates.prompt      = body.data.prompt;
  if (body.data.category !== undefined)    updates.category    = body.data.category;
  if (body.data.tags !== undefined)        updates.tags        = body.data.tags;
  if (body.data.isPublic !== undefined)    updates.is_public   = body.data.isPublic;

  const { data, error } = await supabase
    .from('prompt_templates')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found or not authorised' }, { status: 404 });
  return NextResponse.json(data);
}

// DELETE /api/v1/prompts/[id] — delete template (owner only)
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;
  const { id } = await params;

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('prompt_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
