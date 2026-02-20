import { DidProviderAdapter } from '../adapters/did-provider';
import { HeyGenProviderAdapter } from '../adapters/heygen-provider';
import type { PipelineJobData } from '../types';

const provider = process.env.AI_PROVIDER === 'heygen' ? new HeyGenProviderAdapter() : new DidProviderAdapter();

export async function runAiGeneration(data: PipelineJobData) {
  const result = await provider.generateAvatar({
    jobId: data.jobId,
    sourceType: data.personSourceType,
    sourceUrl: data.personSourceUrl,
    productPhotoUrl: data.productPhotoUrl,
    productDescription: data.productDescription,
    tone: data.tone
  });

  return {
    provider: provider.name,
    ...result
  };
}
