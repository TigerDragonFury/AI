import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestUser } from '../../../../../lib/request-auth';
import { getSupabaseServerClient } from '../../../../../lib/supabase-server';
import { generateImage, type ImageEngineId } from '../../../../../lib/image-engine';

const schema = z.object({
  engine:         z.enum(['openai', 'fal_ai', 'novita', 'freepik', 'stable_diffusion']).default('openai'),
  model:          z.string().optional(),
  prompt:         z.string().min(1).max(2000),
  negativePrompt: z.string().max(500).optional(),
  size:           z.enum(['256x256','512x512','1024x1024','1024x1792','1792x1024']).default('1024x1024'),
  quality:        z.enum(['standard','hd']).default('standard'),
  style:          z.enum(['vivid','natural']).default('vivid'),
  n:              z.number().int().min(1).max(4).default(1),
  steps:          z.number().int().min(1).max(150).optional(),
  guidanceScale:  z.number().min(1).max(30).optional(),
  seed:           z.number().int().optional(),
});

// GET /api/v1/ai/images — list generated images
export async function GET(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;

  const supabase = getSupabaseServerClient();
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1');
  const limit = 20;

  const { data, error, count } = await supabase
    .from('generated_images')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, total: count, page });
}

// POST /api/v1/ai/images — generate image(s)
export async function POST(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;

  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: body.error.issues.map(i => i.message).join(', ') }, { status: 422 });

  const opts = body.data;
  const images = await generateImage({
    engine:         opts.engine as ImageEngineId,
    model:          opts.model,
    prompt:         opts.prompt,
    negativePrompt: opts.negativePrompt,
    size:           opts.size,
    quality:        opts.quality,
    style:          opts.style,
    n:              opts.n,
    steps:          opts.steps,
    guidanceScale:  opts.guidanceScale,
    seed:           opts.seed,
  });

  const supabase = getSupabaseServerClient();
  const rows = images.map((img) => ({
    user_id:         userId,
    engine:          opts.engine,
    model:           opts.model ?? '',
    prompt:          opts.prompt,
    negative_prompt: opts.negativePrompt,
    image_url:       img.url,
    size:            opts.size,
    quality:         opts.quality,
    style:           opts.style,
    seed:            opts.seed ?? null,
  }));

  const { data: saved, error } = await supabase.from('generated_images').insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ images: saved }, { status: 201 });
}
