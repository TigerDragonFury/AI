import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestUser } from '@/lib/request-auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';

const schema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  prompt:      z.string().min(1),
  category:    z.string().default('general'),
  tags:        z.array(z.string()).max(10).default([]),
  isPublic:    z.boolean().default(false),
});

// GET /api/v1/prompts — list prompt templates (own + public)
export async function GET(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;

  const supabase = getSupabaseServerClient();
  const url = new URL(request.url);
  const category = url.searchParams.get('category');

  let query = supabase
    .from('prompt_templates')
    .select('id, title, description, prompt, category, tags, is_public, use_count, created_at, user_id')
    .or(`user_id.eq.${userId},is_public.eq.true`)
    .order('use_count', { ascending: false });

  if (category) query = query.eq('category', category);

  const { data, error } = await query.limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/v1/prompts — create prompt template
export async function POST(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;

  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: body.error.issues.map(i => i.message).join(', ') }, { status: 422 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('prompt_templates')
    .insert({
      user_id:     userId,
      title:       body.data.title,
      description: body.data.description,
      prompt:      body.data.prompt,
      category:    body.data.category,
      tags:        body.data.tags,
      is_public:   body.data.isPublic,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
