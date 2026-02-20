export type GenerateAvatarInput = {
  jobId: string;
  sourceType: 'video' | 'photo';
  sourceUrl?: string;
  productPhotoUrl?: string;
  productDescription?: string;
  tone?: string;
};

export type GenerateAvatarResult = {
  outputVideoUrl: string;
  providerJobId: string;
};

export interface AiProviderAdapter {
  name: string;
  generateAvatar(input: GenerateAvatarInput): Promise<GenerateAvatarResult>;
}
