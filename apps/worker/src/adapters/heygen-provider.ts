import { AiProviderAdapter, GenerateAvatarInput, GenerateAvatarResult } from './ai-provider';

export class HeyGenProviderAdapter implements AiProviderAdapter {
  name = 'heygen';

  async generateAvatar(input: GenerateAvatarInput): Promise<GenerateAvatarResult> {
    const providerJobId = `heygen-${input.jobId}`;
    return {
      providerJobId,
      outputVideoUrl: `generated_ads/${input.jobId}-heygen.mp4`
    };
  }
}
