/**
 * Text-to-Image Engine Abstraction
 * Supports: OpenAI DALL-E 3, Stable Diffusion (via fal.ai / Novita), Freepik
 */

export type ImageEngineId = 'openai' | 'fal_ai' | 'novita' | 'freepik' | 'stable_diffusion';

export interface ImageGenerationOptions {
  engine: ImageEngineId;
  model?: string;
  prompt: string;
  negativePrompt?: string;
  size?: '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  n?: number;
  steps?: number;
  guidanceScale?: number;
  seed?: number;
}

export interface GeneratedImage {
  url: string;
  b64?: string;
  revisedPrompt?: string;
}

export async function generateImage(opts: ImageGenerationOptions): Promise<GeneratedImage[]> {
  switch (opts.engine) {
    case 'openai':
      return generateOpenAIImage(opts);
    case 'fal_ai':
      return generateFalAIImage(opts);
    case 'novita':
      return generateNovitaImage(opts);
    case 'freepik':
      return generateFreepikImage(opts);
    default:
      throw new Error(`Unknown image engine: ${opts.engine}`);
  }
}

// ── OpenAI DALL-E 3 ──────────────────────────────────────────────────────────
async function generateOpenAIImage(opts: ImageGenerationOptions): Promise<GeneratedImage[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const resp = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: opts.model ?? 'dall-e-3',
      prompt: opts.prompt,
      n: opts.n ?? 1,
      size: opts.size ?? '1024x1024',
      quality: opts.quality ?? 'standard',
      style: opts.style ?? 'vivid',
      response_format: 'url',
    }),
  });

  if (!resp.ok) throw new Error(`OpenAI image error: ${await resp.text()}`);
  const data = (await resp.json()) as { data: { url: string; revised_prompt?: string }[] };
  return data.data.map((d) => ({ url: d.url, revisedPrompt: d.revised_prompt }));
}

// ── fal.ai (FLUX, SD, etc.) ──────────────────────────────────────────────────
async function generateFalAIImage(opts: ImageGenerationOptions): Promise<GeneratedImage[]> {
  const apiKey = process.env.FAL_AI_API_KEY;
  if (!apiKey) throw new Error('FAL_AI_API_KEY not set');

  const model = opts.model ?? 'fal-ai/flux/schnell';
  const resp = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Key ${apiKey}` },
    body: JSON.stringify({
      prompt: opts.prompt,
      negative_prompt: opts.negativePrompt,
      image_size: opts.size ?? '1024x1024',
      num_inference_steps: opts.steps ?? 4,
      guidance_scale: opts.guidanceScale ?? 3.5,
      num_images: opts.n ?? 1,
      seed: opts.seed,
    }),
  });

  if (!resp.ok) throw new Error(`fal.ai error: ${await resp.text()}`);
  const data = (await resp.json()) as { images: { url: string }[] };
  return data.images.map((img) => ({ url: img.url }));
}

// ── Novita AI ────────────────────────────────────────────────────────────────
async function generateNovitaImage(opts: ImageGenerationOptions): Promise<GeneratedImage[]> {
  const apiKey = process.env.NOVITA_API_KEY;
  if (!apiKey) throw new Error('NOVITA_API_KEY not set');

  const resp = await fetch('https://api.novita.ai/v3/async/txt2img', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      request: {
        model_name: opts.model ?? 'sd_xl_base_1.0.safetensors',
        prompt: opts.prompt,
        negative_prompt: opts.negativePrompt ?? '',
        width: parseInt((opts.size ?? '1024x1024').split('x')[0]),
        height: parseInt((opts.size ?? '1024x1024').split('x')[1]),
        steps: opts.steps ?? 25,
        guidance_scale: opts.guidanceScale ?? 7.5,
        batch_size: opts.n ?? 1,
        seed: opts.seed ?? -1,
        sampler_name: 'DPM++ 2M Karras',
      },
    }),
  });

  if (!resp.ok) throw new Error(`Novita error: ${await resp.text()}`);
  const taskData = (await resp.json()) as { task_id: string };

  // Poll for result
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollResp = await fetch(`https://api.novita.ai/v3/async/task-result?task_id=${taskData.task_id}`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    const result = (await pollResp.json()) as { task: { status: string; imgs: { image_url: string }[] } };
    if (result.task?.status === 'TASK_STATUS_SUCCEED') {
      return result.task.imgs.map((img) => ({ url: img.image_url }));
    }
    if (result.task?.status === 'TASK_STATUS_FAILED') {
      throw new Error('Novita generation failed');
    }
  }
  throw new Error('Novita generation timed out');
}

// ── Freepik ──────────────────────────────────────────────────────────────────
async function generateFreepikImage(opts: ImageGenerationOptions): Promise<GeneratedImage[]> {
  const apiKey = process.env.FREEPIK_API_KEY;
  if (!apiKey) throw new Error('FREEPIK_API_KEY not set');

  const resp = await fetch('https://api.freepik.com/v1/ai/text-to-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-freepik-api-key': apiKey },
    body: JSON.stringify({
      prompt: opts.prompt,
      negative_prompt: opts.negativePrompt,
      num_images: opts.n ?? 1,
      image: { size: opts.size?.toLowerCase().replace('x', ':') ?? '1:1' },
      styling: { style: 'photo', color: 'vibrant' },
    }),
  });

  if (!resp.ok) throw new Error(`Freepik error: ${await resp.text()}`);
  const data = (await resp.json()) as { data: { base64: string }[] };
  return data.data.map((item) => ({
    url: `data:image/jpeg;base64,${item.base64}`,
    b64: item.base64,
  }));
}

// ── Engine model lists ────────────────────────────────────────────────────────
export const IMAGE_MODELS: Record<ImageEngineId, { id: string; label: string }[]> = {
  openai:           [{ id: 'dall-e-3', label: 'DALL-E 3' }, { id: 'dall-e-2', label: 'DALL-E 2' }],
  fal_ai:           [
    { id: 'fal-ai/flux/schnell', label: 'FLUX Schnell (fast)' },
    { id: 'fal-ai/flux/dev',     label: 'FLUX Dev (quality)' },
    { id: 'fal-ai/stable-diffusion-v3-medium', label: 'SD3 Medium' },
  ],
  novita:           [
    { id: 'sd_xl_base_1.0.safetensors', label: 'SDXL Base 1.0' },
    { id: 'dreamshaper_8.safetensors',  label: 'DreamShaper 8' },
    { id: 'epicrealism_naturalSinRC1VAE.safetensors', label: 'Epic Realism' },
  ],
  freepik:          [{ id: 'freepik-default', label: 'Freepik AI' }],
  stable_diffusion: [{ id: 'stable-diffusion-xl-1024-v1-0', label: 'SDXL 1.0' }],
};
