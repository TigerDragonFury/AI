import { Queue } from 'bullmq';
import type { JobRecord } from '@packages/shared';

function getConnection() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const parsedUrl = new URL(redisUrl);
  return {
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || 6379),
    username: parsedUrl.username || undefined,
    password: parsedUrl.password || undefined,
    maxRetriesPerRequest: null as null
  };
}

let videoProcessingQueue: Queue | null = null;
let aiGenerationQueue: Queue | null = null;
let analyticsSyncQueue: Queue | null = null;
let adsBoostQueue: Queue | null = null;
let socialPublishingQueue: Queue | null = null;
let mediaValidationQueue: Queue | null = null;

function getVideoProcessingQueue() {
  if (!videoProcessingQueue) {
    videoProcessingQueue = new Queue('video_processing', { connection: getConnection() });
  }
  return videoProcessingQueue;
}

function getMediaValidationQueue() {
  if (!mediaValidationQueue) {
    mediaValidationQueue = new Queue('media_validation', { connection: getConnection() });
  }
  return mediaValidationQueue;
}

function getAiGenerationQueue() {
  if (!aiGenerationQueue) {
    aiGenerationQueue = new Queue('ai_generation', { connection: getConnection() });
  }
  return aiGenerationQueue;
}

function getAnalyticsSyncQueue() {
  if (!analyticsSyncQueue) {
    analyticsSyncQueue = new Queue('analytics_sync', { connection: getConnection() });
  }
  return analyticsSyncQueue;
}

function getAdsBoostQueue() {
  if (!adsBoostQueue) {
    adsBoostQueue = new Queue('ads_boost', { connection: getConnection() });
  }
  return adsBoostQueue;
}

function getSocialPublishingQueue() {
  if (!socialPublishingQueue) {
    socialPublishingQueue = new Queue('social_publishing', { connection: getConnection() });
  }
  return socialPublishingQueue;
}

function toPipelineData(job: JobRecord) {
  return {
    jobId: job.id,
    userId: job.userId,
    personSourceType: job.personSourceType,
    personSourceUrl: job.personSourceUrl,
    productPhotoUrl: job.productPhotoUrl,
    productDescription: job.productDescription,
    tone: job.tone,
    targetPlatforms: job.targetPlatforms
  };
}

export async function enqueueNewJob(job: JobRecord) {
  // Media validation runs first; on success the worker fans out to video_processing
  await getMediaValidationQueue().add('validate-media', toPipelineData(job), {
    attempts: 2,
    removeOnComplete: true,
    removeOnFail: 50
  });
}

export async function enqueueRegeneration(job: JobRecord) {
  await getAiGenerationQueue().add('ai-generate', toPipelineData(job), {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: 50
  });
}

export async function enqueueAnalyticsSync(payload: {
  userId: string;
  publishedPostId: string;
  platforms: string[];
}) {
  await getAnalyticsSyncQueue().add('analytics-sync', payload, {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: 50
  });
}

export async function enqueueAdsBoost(payload: {
  userId: string;
  postId: string;
  platform: string;
  budget: number;
  durationDays: number;
  objective: 'REACH' | 'VIDEO_VIEWS';
}) {
  await getAdsBoostQueue().add('ads-boost', payload, {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: 50
  });
}

export async function enqueueScheduledPublish(payload: {
  userId: string;
  jobId: string;
  platforms: string[];
  scheduleAt: string;
}) {
  const delayMs = Math.max(0, new Date(payload.scheduleAt).getTime() - Date.now());
  await getSocialPublishingQueue().add(
    'social-publish-scheduled',
    {
      jobId: payload.jobId,
      userId: payload.userId,
      targetPlatforms: payload.platforms,
      // personSourceType and other fields will be loaded by the worker from DB
      personSourceType: 'photo' as const
    },
    {
      delay: delayMs,
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: 50
    }
  );
}
