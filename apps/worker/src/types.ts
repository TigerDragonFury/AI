export type PipelineJobData = {
  jobId: string;
  userId: string;
  personSourceType: 'video' | 'photo';
  personSourceUrl?: string;
  productPhotoUrl?: string;
  productDescription?: string;
  tone?: string;
  targetPlatforms: string[];
};

export type ProcessContext = {
  traceId: string;
  timestamp: string;
};
