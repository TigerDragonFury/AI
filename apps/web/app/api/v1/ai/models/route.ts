import { NextResponse } from 'next/server';
import { CHAT_MODELS, MODEL_REGISTRY } from '../../../../../lib/ai-engine';
import { IMAGE_MODELS } from '../../../../../lib/image-engine';
import { TTS_VOICES, TTS_MODELS } from '../../../../../lib/tts-engine';

export async function GET() {
  return NextResponse.json({
    chat: CHAT_MODELS.map((m) => ({
      id: m.id,
      label: m.label,
      engine: m.engine,
      contextWindow: m.contextWindow,
      capabilities: m.capabilities,
    })),
    image: IMAGE_MODELS,
    tts: {
      voices: TTS_VOICES,
      models: TTS_MODELS,
    },
    all: MODEL_REGISTRY.map((m) => ({ id: m.id, label: m.label, engine: m.engine })),
  });
}
