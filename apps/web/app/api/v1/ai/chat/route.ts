import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestUser } from '../../../../../lib/request-auth';
import { getSupabaseServerClient } from '../../../../../lib/supabase-server';

const createSchema = z.object({
  title:        z.string().max(200).optional(),
  engine:       z.string().default('openai'),
  model:        z.string().default('gpt-4o-mini'),
  systemPrompt: z.string().optional(),
  personaId:    z.string().uuid().optional(),
});

// GET /api/v1/ai/chat — list user's chats
export async function GET(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ai_chats')
    .select('id, title, engine, model, is_archived, created_at, updated_at')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/v1/ai/chat — create new chat
export async function POST(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;

  const body = createSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: body.error.issues.map(i => i.message).join(', ') }, { status: 422 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('ai_chats')
    .insert({
      user_id:      userId,
      title:        body.data.title ?? 'New Chat',
      engine:       body.data.engine,
      model:        body.data.model,
      system_prompt: body.data.systemPrompt,
      persona_id:   body.data.personaId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
