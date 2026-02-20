import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestUser } from '../../../../../lib/request-auth';
import { getSupabaseServerClient } from '../../../../../lib/supabase-server';
import { synthesizeSpeech, type TtsEngineId } from '../../../../../lib/tts-engine';
import { createClient } from '@supabase/supabase-js';

const schema = z.object({
  engine:          z.enum(['openai', 'elevenlabs', 'speechify']).default('openai'),
  model:           z.string().optional(),
  voice:           z.string().optional(),
  text:            z.string().min(1).max(5000),
  speed:           z.number().min(0.25).max(4).default(1),
  stability:       z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
});

// GET /api/v1/ai/tts — list generated TTS audio
export async function GET(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('generated_tts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/v1/ai/tts — synthesize and store audio
export async function POST(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;

  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: body.error.issues.map(i => i.message).join(', ') }, { status: 422 });

  const { engine, model, voice, text, speed, stability, similarityBoost } = body.data;

  const result = await synthesizeSpeech({
    engine: engine as TtsEngineId,
    model,
    voice,
    text,
    speed,
    stability,
    similarityBoost,
  });

  // Upload audio to Supabase Storage bucket "generated_audio"
  const storageClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const filename = `tts/${userId}/${Date.now()}.mp3`;
  await storageClient.storage.from('generated_audio').upload(filename, result.audioBuffer, {
    contentType: result.mimeType,
    upsert: false,
  });
  const { data: signedUrl } = await storageClient.storage.from('generated_audio').createSignedUrl(filename, 60 * 60 * 24 * 7);

  const supabase = getSupabaseServerClient();
  const { data: saved, error } = await supabase
    .from('generated_tts')
    .insert({
      user_id:    userId,
      engine,
      model:      model ?? null,
      voice_id:   voice ?? null,
      text_input: text,
      audio_url:  signedUrl?.signedUrl ?? filename,
      file_size:  result.audioBuffer.length,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(saved, { status: 201 });
}
