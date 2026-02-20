import { Queue } from 'bullmq';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const parsedUrl = new URL(redisUrl);
export const connection = {
  host: parsedUrl.hostname,
  port: Number(parsedUrl.port || 6379),
  username: parsedUrl.username || undefined,
  password: parsedUrl.password || undefined,
  maxRetriesPerRequest: null
};

export const videoProcessingQueue = new Queue('video_processing', { connection });
export const aiGenerationQueue = new Queue('ai_generation', { connection });
export const socialPublishingQueue = new Queue('social_publishing', { connection });
export const adsBoostQueue = new Queue('ads_boost', { connection });
export const analyticsSyncQueue = new Queue('analytics_sync', { connection });
export const mediaValidationQueue = new Queue('media_validation', { connection });

export async function closeQueues() {
  await Promise.all([
    videoProcessingQueue.close(),
    aiGenerationQueue.close(),
    socialPublishingQueue.close(),
    adsBoostQueue.close(),
    analyticsSyncQueue.close(),
    mediaValidationQueue.close()
  ]);
}
