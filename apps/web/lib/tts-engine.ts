/**
 * Text-to-Speech Engine Abstraction
 * Supports: OpenAI TTS, ElevenLabs, Speechify
 */

export type TtsEngineId = 'openai' | 'elevenlabs' | 'speechify';

export interface TtsOptions {
  engine: TtsEngineId;
  text: string;
  voice?: string;
  model?: string;
  speed?: number;       // 0.25 – 4.0 (OpenAI), not all engines
  stability?: number;   // ElevenLabs 0–1
  similarityBoost?: number; // ElevenLabs 0–1
}

export interface TtsResult {
  audioUrl?: string;     // Pre-signed URL if stored
  audioBuffer: Buffer;   // Raw audio bytes
  mimeType: string;
  durationSeconds?: number;
}

export async function synthesizeSpeech(opts: TtsOptions): Promise<TtsResult> {
  switch (opts.engine) {
    case 'openai':
      return openaiTts(opts);
    case 'elevenlabs':
      return elevenlabsTts(opts);
    case 'speechify':
      return speechifyTts(opts);
    default:
      throw new Error(`Unknown TTS engine: ${opts.engine}`);
  }
}

// ── OpenAI TTS ───────────────────────────────────────────────────────────────
async function openaiTts(opts: TtsOptions): Promise<TtsResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const resp = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: opts.model ?? 'tts-1-hd',
      input: opts.text,
      voice: opts.voice ?? 'alloy',
      speed: opts.speed ?? 1.0,
      response_format: 'mp3',
    }),
  });

  if (!resp.ok) throw new Error(`OpenAI TTS error: ${await resp.text()}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  return { audioBuffer: buffer, mimeType: 'audio/mpeg' };
}

// ── ElevenLabs ───────────────────────────────────────────────────────────────
async function elevenlabsTts(opts: TtsOptions): Promise<TtsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set');

  const voiceId = opts.voice ?? '21m00Tcm4TlvDq8ikWAM'; // Rachel (default)
  const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: opts.text,
      model_id: opts.model ?? 'eleven_multilingual_v2',
      voice_settings: {
        stability: opts.stability ?? 0.5,
        similarity_boost: opts.similarityBoost ?? 0.75,
        style: 0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!resp.ok) throw new Error(`ElevenLabs TTS error: ${await resp.text()}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  return { audioBuffer: buffer, mimeType: 'audio/mpeg' };
}

// ── Speechify ────────────────────────────────────────────────────────────────
async function speechifyTts(opts: TtsOptions): Promise<TtsResult> {
  const apiKey = process.env.SPEECHIFY_API_KEY;
  if (!apiKey) throw new Error('SPEECHIFY_API_KEY not set');

  const resp = await fetch('https://api.sws.speechify.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      input: `<speak>${opts.text}</speak>`,
      voice_id: opts.voice ?? 'george',
      audio_format: 'mp3',
    }),
  });

  if (!resp.ok) throw new Error(`Speechify TTS error: ${await resp.text()}`);
  const data = (await resp.json()) as { audio_data: string };
  const buffer = Buffer.from(data.audio_data, 'base64');
  return { audioBuffer: buffer, mimeType: 'audio/mpeg' };
}

// ── Voice catalogs ────────────────────────────────────────────────────────────
export const TTS_VOICES: Record<TtsEngineId, { id: string; label: string; language?: string }[]> = {
  openai: [
    { id: 'alloy',   label: 'Alloy',   language: 'en' },
    { id: 'echo',    label: 'Echo',    language: 'en' },
    { id: 'fable',   label: 'Fable',   language: 'en' },
    { id: 'onyx',    label: 'Onyx',    language: 'en' },
    { id: 'nova',    label: 'Nova',    language: 'en' },
    { id: 'shimmer', label: 'Shimmer', language: 'en' },
  ],
  elevenlabs: [
    { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel',  language: 'en' },
    { id: 'AZnzlk1XvdvUeBnXmlld', label: 'Domi',    language: 'en' },
    { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella',   language: 'en' },
    { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni',  language: 'en' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli',    language: 'en' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh',    language: 'en' },
  ],
  speechify: [
    { id: 'george',  label: 'George',  language: 'en' },
    { id: 'olivia',  label: 'Olivia',  language: 'en' },
    { id: 'henry',   label: 'Henry',   language: 'en' },
    { id: 'emma',    label: 'Emma',    language: 'en' },
  ],
};

export const TTS_MODELS: Record<TtsEngineId, { id: string; label: string }[]> = {
  openai: [
    { id: 'tts-1',    label: 'TTS-1 (fast)' },
    { id: 'tts-1-hd', label: 'TTS-1 HD (quality)' },
  ],
  elevenlabs: [
    { id: 'eleven_monolingual_v1',   label: 'Monolingual v1' },
    { id: 'eleven_multilingual_v2',  label: 'Multilingual v2' },
    { id: 'eleven_turbo_v2',         label: 'Turbo v2 (fast)' },
  ],
  speechify: [{ id: 'simba-base', label: 'Simba Base' }],
};
