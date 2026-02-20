import { AiProviderAdapter, GenerateAvatarInput, GenerateAvatarResult } from './ai-provider';

export class DidProviderAdapter implements AiProviderAdapter {
  name = 'd-id';

  async generateAvatar(input: GenerateAvatarInput): Promise<GenerateAvatarResult> {
    const providerJobId = `did-${input.jobId}`;
    return {
      providerJobId,
      outputVideoUrl: `generated_ads/${input.jobId}-did.mp4`
    };
  }
}
