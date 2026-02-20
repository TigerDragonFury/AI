/**
 * Multi-AI Engine Abstraction Layer
 * Mirrors MagicAI's Engine/Entity driver pattern in TypeScript.
 * Supports: OpenAI, Anthropic, Gemini, DeepSeek, xAI (Grok), OpenRouter, Together AI
 */
export type EngineId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'deep_seek'
  | 'x_ai'
  | 'open_router'
  | 'together'
  | 'azure';

export type ModelCapability = 'chat' | 'vision' | 'streaming' | 'function_calling' | 'image_gen' | 'embedding';

export interface ModelDef {
  id: string;
  label: string;
  engine: EngineId;
  contextWindow: number; // tokens
  capabilities: ModelCapability[];
  costPer1kInput: number;  // USD
  costPer1kOutput: number; // USD
}

// ─── Model registry (mirrors EntityEnum.php) ──────────────────────────────────
export const MODEL_REGISTRY: ModelDef[] = [
  // ── OpenAI ──
  { id: 'gpt-4o',         label: 'GPT-4o',               engine: 'openai',    contextWindow: 128_000, capabilities: ['chat','vision','streaming','function_calling'], costPer1kInput: 0.005,   costPer1kOutput: 0.015 },
  { id: 'gpt-4o-mini',    label: 'GPT-4o Mini',          engine: 'openai',    contextWindow: 128_000, capabilities: ['chat','vision','streaming','function_calling'], costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
  { id: 'gpt-4-turbo',    label: 'GPT-4 Turbo',          engine: 'openai',    contextWindow: 128_000, capabilities: ['chat','vision','streaming','function_calling'], costPer1kInput: 0.01,    costPer1kOutput: 0.03 },
  { id: 'gpt-4',          label: 'GPT-4',                engine: 'openai',    contextWindow: 8_192,   capabilities: ['chat','streaming','function_calling'],          costPer1kInput: 0.03,    costPer1kOutput: 0.06 },
  { id: 'gpt-3.5-turbo',  label: 'GPT-3.5 Turbo',       engine: 'openai',    contextWindow: 16_385,  capabilities: ['chat','streaming','function_calling'],          costPer1kInput: 0.0005,  costPer1kOutput: 0.0015 },
  { id: 'o1',             label: 'o1',                   engine: 'openai',    contextWindow: 200_000, capabilities: ['chat','vision'],                                costPer1kInput: 0.015,   costPer1kOutput: 0.06 },
  { id: 'o3-mini',        label: 'o3 Mini',              engine: 'openai',    contextWindow: 200_000, capabilities: ['chat','streaming'],                             costPer1kInput: 0.0011,  costPer1kOutput: 0.0044 },
  // ── Anthropic ──
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet',  engine: 'anthropic', contextWindow: 200_000, capabilities: ['chat','vision','streaming','function_calling'], costPer1kInput: 0.003,  costPer1kOutput: 0.015 },
  { id: 'claude-3-5-haiku-20241022',  label: 'Claude 3.5 Haiku',   engine: 'anthropic', contextWindow: 200_000, capabilities: ['chat','vision','streaming','function_calling'], costPer1kInput: 0.0008, costPer1kOutput: 0.004 },
  { id: 'claude-3-opus-20240229',     label: 'Claude 3 Opus',      engine: 'anthropic', contextWindow: 200_000, capabilities: ['chat','vision','streaming','function_calling'], costPer1kInput: 0.015,  costPer1kOutput: 0.075 },
  { id: 'claude-3-haiku-20240307',    label: 'Claude 3 Haiku',     engine: 'anthropic', contextWindow: 200_000, capabilities: ['chat','vision','streaming'],                     costPer1kInput: 0.00025,costPer1kOutput: 0.00125 },
  // ── Google Gemini ──
  { id: 'gemini-2.0-flash',           label: 'Gemini 2.0 Flash',   engine: 'gemini',    contextWindow: 1_048_576, capabilities: ['chat','vision','streaming','function_calling'], costPer1kInput: 0.0001, costPer1kOutput: 0.0004 },
  { id: 'gemini-1.5-pro',             label: 'Gemini 1.5 Pro',     engine: 'gemini',    contextWindow: 2_097_152, capabilities: ['chat','vision','streaming','function_calling'], costPer1kInput: 0.00125,costPer1kOutput: 0.005 },
  { id: 'gemini-1.5-flash',           label: 'Gemini 1.5 Flash',   engine: 'gemini',    contextWindow: 1_048_576, capabilities: ['chat','vision','streaming'],                     costPer1kInput: 0.000075,costPer1kOutput: 0.0003 },
  // ── DeepSeek ──
  { id: 'deepseek-chat',          label: 'DeepSeek Chat',         engine: 'deep_seek', contextWindow: 64_000, capabilities: ['chat','streaming'],            costPer1kInput: 0.00014, costPer1kOutput: 0.00028 },
  { id: 'deepseek-reasoner',      label: 'DeepSeek Reasoner',     engine: 'deep_seek', contextWindow: 64_000, capabilities: ['chat','streaming'],            costPer1kInput: 0.00055, costPer1kOutput: 0.0022 },
  // ── xAI (Grok) ──
  { id: 'grok-2',         label: 'Grok-2',               engine: 'x_ai',      contextWindow: 131_072, capabilities: ['chat','vision','streaming'],            costPer1kInput: 0.002,  costPer1kOutput: 0.01 },
  { id: 'grok-2-mini',    label: 'Grok-2 Mini',          engine: 'x_ai',      contextWindow: 131_072, capabilities: ['chat','streaming'],                     costPer1kInput: 0.0002, costPer1kOutput: 0.001 },
  // ── OpenRouter (meta-gateway) ──
  { id: 'openrouter/auto',        label: 'OpenRouter Auto',       engine: 'open_router', contextWindow: 200_000, capabilities: ['chat','streaming'],  costPer1kInput: 0,  costPer1kOutput: 0 },
  { id: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B',  engine: 'open_router', contextWindow: 131_072, capabilities: ['chat','streaming'], costPer1kInput: 0.00052, costPer1kOutput: 0.00075 },
  { id: 'mistralai/mistral-large', label: 'Mistral Large',        engine: 'open_router', contextWindow: 131_072, capabilities: ['chat','streaming'],  costPer1kInput: 0.002, costPer1kOutput: 0.006 },
  // ── Together AI ──
  { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',   label: 'Llama 3.1 8B Turbo',  engine: 'together', contextWindow: 131_072, capabilities: ['chat','streaming'], costPer1kInput: 0.0002, costPer1kOutput: 0.0002 },
  { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',           label: 'Mixtral 8x7B',        engine: 'together', contextWindow: 32_768,  capabilities: ['chat','streaming'], costPer1kInput: 0.0006, costPer1kOutput: 0.0006 },
];

export function getModelsByEngine(engine: EngineId): ModelDef[] {
  return MODEL_REGISTRY.filter((m) => m.engine === engine);
}

export function findModel(modelId: string): ModelDef | undefined {
  return MODEL_REGISTRY.find((m) => m.id === modelId);
}

export const CHAT_MODELS = MODEL_REGISTRY.filter((m) => m.capabilities.includes('chat'));

// ─── Engine API base URLs ─────────────────────────────────────────────────────
export const ENGINE_BASE_URLS: Record<EngineId, string> = {
  openai:       'https://api.openai.com/v1',
  anthropic:    'https://api.anthropic.com/v1',
  gemini:       'https://generativelanguage.googleapis.com/v1beta',
  deep_seek:    'https://api.deepseek.com/v1',
  x_ai:         'https://api.x.ai/v1',
  open_router:  'https://openrouter.ai/api/v1',
  together:     'https://api.together.xyz/v1',
  azure:        process.env.AZURE_OPENAI_BASE_URL ?? '',
};

export function getEngineApiKey(engine: EngineId): string {
  switch (engine) {
    case 'openai':      return process.env.OPENAI_API_KEY ?? '';
    case 'anthropic':   return process.env.ANTHROPIC_API_KEY ?? '';
    case 'gemini':      return process.env.GEMINI_API_KEY ?? '';
    case 'deep_seek':   return process.env.DEEPSEEK_API_KEY ?? '';
    case 'x_ai':        return process.env.XAI_API_KEY ?? '';
    case 'open_router': return process.env.OPENROUTER_API_KEY ?? '';
    case 'together':    return process.env.TOGETHER_API_KEY ?? '';
    case 'azure':       return process.env.AZURE_OPENAI_API_KEY ?? '';
    default:            return '';
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * Unified chat/completion — returns a ReadableStream for SSE streaming.
 * Normalises the request format across all engines.
 */
export async function streamCompletion(opts: CompletionOptions): Promise<Response> {
  const model = findModel(opts.model);
  const engine: EngineId = (model?.engine ?? 'openai') as EngineId;
  const apiKey = getEngineApiKey(engine);
  const baseUrl = ENGINE_BASE_URLS[engine];

  if (!apiKey) {
    throw new Error(`No API key configured for engine: ${engine}`);
  }

  // ── Anthropic ───────────────────────────────────────────────────────────────
  if (engine === 'anthropic') {
    const systemMsg = opts.messages.find((m) => m.role === 'system');
    const userMsgs = opts.messages.filter((m) => m.role !== 'system');
    return fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 4096,
        stream: true,
        system: systemMsg?.content,
        messages: userMsgs,
        temperature: opts.temperature ?? 0.7,
      }),
    });
  }

  // ── Gemini ──────────────────────────────────────────────────────────────────
  if (engine === 'gemini') {
    const contents = opts.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const systemInstruction = opts.messages.find((m) => m.role === 'system');
    return fetch(
      `${baseUrl}/models/${opts.model}:streamGenerateContent?key=${apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction.content }] }
            : undefined,
          generationConfig: { maxOutputTokens: opts.maxTokens ?? 4096, temperature: opts.temperature ?? 0.7 },
        }),
      }
    );
  }

  // ── OpenAI-compatible (openai, deep_seek, x_ai, open_router, together, azure) ──
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
  };
  if (engine === 'open_router') {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    headers['X-Title'] = 'AI Ad Platform';
  }
  const url =
    engine === 'azure'
      ? `${baseUrl}/openai/deployments/${opts.model}/chat/completions?api-version=2024-02-01`
      : `${baseUrl}/chat/completions`;

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: engine === 'azure' ? undefined : opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4096,
      stream: true,
    }),
  });
}

/**
 * Non-streaming text completion — resolves to full response string.
 */
export async function complete(opts: CompletionOptions): Promise<string> {
  const streamResp = await streamCompletion({ ...opts, stream: true });
  if (!streamResp.ok) {
    const err = await streamResp.text();
    throw new Error(`AI engine error (${streamResp.status}): ${err}`);
  }
  const reader = streamResp.body?.getReader();
  if (!reader) throw new Error('No response body');
  const decoder = new TextDecoder();
  let result = '';
  const model = findModel(opts.model);
  const engine: EngineId = (model?.engine ?? 'openai') as EngineId;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split('\n')) {
      const trimmed = line.replace(/^data:\s*/, '').trim();
      if (!trimmed || trimmed === '[DONE]') continue;
      try {
        const json = JSON.parse(trimmed);
        // OpenAI / compatible
        if (engine !== 'anthropic' && engine !== 'gemini') {
          result += json.choices?.[0]?.delta?.content ?? '';
        }
        // Anthropic
        if (engine === 'anthropic' && json.type === 'content_block_delta') {
          result += json.delta?.text ?? '';
        }
        // Gemini
        if (engine === 'gemini') {
          result += json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        }
      } catch {
        // ignore parse errors on partial chunks
      }
    }
  }
  return result;
}
