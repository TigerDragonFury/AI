import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestUser } from '../../../../../lib/request-auth';
import { getSupabaseServerClient } from '../../../../../lib/supabase-server';
import { complete } from '../../../../../lib/ai-engine';

const CONTENT_TYPES = ['article', 'blog', 'email', 'ad_copy', 'social', 'product_description', 'seo_meta', 'custom'] as const;
type ContentType = typeof CONTENT_TYPES[number];

const schema = z.object({
  type:        z.enum(CONTENT_TYPES).default('article'),
  title:       z.string().min(1).max(300),
  topic:       z.string().min(1),
  tone:        z.string().default('professional'),
  language:    z.string().default('English'),
  keywords:    z.array(z.string()).max(10).default([]),
  wordCount:   z.number().int().min(50).max(5000).default(500),
  engine:      z.string().default('openai'),
  model:       z.string().default('gpt-4o-mini'),
  customPrompt: z.string().optional(),
});

const SYSTEM_PROMPTS: Record<ContentType, string> = {
  article:             'You are an expert article writer. Write clear, well-structured, SEO-friendly articles.',
  blog:                'You are a professional blog writer. Write engaging, conversational blog posts.',
  email:               'You are an expert copywriter specialising in email marketing. Write compelling email copy.',
  ad_copy:             'You are an advertising copywriter. Write persuasive, concise ad copy that drives action.',
  social:              'You are a social media specialist. Write engaging, platform-appropriate social posts.',
  product_description: 'You are an e-commerce copywriter. Write persuasive product descriptions that convert.',
  seo_meta:            'You are an SEO specialist. Write optimised meta titles and descriptions.',
  custom:              'You are an expert AI content writer.',
};

// GET /api/v1/ai/content — list generated documents
export async function GET(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;

  const supabase = getSupabaseServerClient();
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const page = parseInt(url.searchParams.get('page') ?? '1');
  const limit = 20;

  let query = supabase
    .from('generated_content')
    .select('id, type, title, words, engine, model, is_favourite, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/v1/ai/content — generate content
export async function POST(request: Request) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;

  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: body.error.issues.map(i => i.message).join(', ') }, { status: 422 });

  const { type, title, topic, tone, language, keywords, wordCount, engine, model, customPrompt } = body.data;

  const systemPrompt = body.data.customPrompt ? body.data.customPrompt : SYSTEM_PROMPTS[type];

  const userPrompt = type === 'seo_meta'
    ? `Write an SEO meta title (max 60 chars) and meta description (max 160 chars) for:
Title: ${title}
Topic: ${topic}
Keywords: ${keywords.join(', ')}
Language: ${language}
Return JSON: { "metaTitle": "...", "metaDescription": "..." }`
    : `Write ${type === 'article' ? 'an article' : `a ${type}`} with the following requirements:
Title: ${title}
Topic: ${topic}
Tone: ${tone}
Language: ${language}
Target word count: ${wordCount} words
${keywords.length ? `Keywords to include: ${keywords.join(', ')}` : ''}
${customPrompt ? `Additional instructions: ${customPrompt}` : ''}

Format with clear headings where appropriate.`;

  const content = await complete({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.75,
    maxTokens: Math.ceil(wordCount * 2),
  });

  const wordCountActual = content.trim().split(/\s+/).length;

  const supabase = getSupabaseServerClient();
  const { data: saved, error } = await supabase
    .from('generated_content')
    .insert({
      user_id: userId,
      type,
      title,
      prompt:  userPrompt,
      content,
      engine,
      model,
      words:   wordCountActual,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(saved, { status: 201 });
}
