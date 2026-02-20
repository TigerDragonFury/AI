import * as Sentry from '@sentry/node';
import { Worker } from 'bullmq';
import {
  adsBoostQueue,
  analyticsSyncQueue,
  aiGenerationQueue,
  closeQueues,
  connection,
  mediaValidationQueue,
  socialPublishingQueue,
  videoProcessingQueue
} from './queues';
import { runMediaValidation } from './pipelines/media-validation';
import { runAdsBoost } from './pipelines/ads-boost';
import { runAnalyticsSweep } from './pipelines/analytics-sweep';
import { runAnalyticsSync } from './pipelines/analytics-sync';
import { runAiGeneration } from './pipelines/ai-generation';
import { runSocialPublishing } from './pipelines/social-publishing';
import { runVideoProcessing } from './pipelines/video-processing';
import { ensureAnalyticsSyncScheduler } from './schedulers/analytics-scheduler';
import { getWorkerSupabaseClient } from './lib/supabase';
import { notifyJobFailure } from './lib/notifications';
import type { PipelineJobData } from './types';

// ── Sentry ────────────────────────────────────────────────────────────────────
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0.1
});

const defaultWorkerOptions = {
  connection,
  concurrency: 3
};

// ── Helper: attach failure notifications to any Worker ────────────────────────
async function lookupUserEmail(userId: string): Promise<string | undefined> {
  const db = getWorkerSupabaseClient();
  if (!db) return undefined;
  const { data } = await db.auth.admin.getUserById(userId);
  return data?.user?.email ?? undefined;
}

function attachFailedHook(worker: Worker, pipeline: string) {
  worker.on('failed', async (job, err) => {
    Sentry.captureException(err, { tags: { pipeline }, extra: { jobId: job?.data?.jobId } });

    const data = job?.data as PipelineJobData | undefined;
    if (!data?.jobId) return;

    const userEmail = await lookupUserEmail(data.userId).catch(() => undefined);
    await notifyJobFailure({
      jobId: data.jobId,
      userId: data.userId,
      userEmail,
      errorMessage: err.message,
      pipeline
    });
  });
}

// ── 0. Media validation ───────────────────────────────────────────────────────
const mediaValidationWorker = new Worker(
  mediaValidationQueue.name,
  async (job) => {
    const data = job.data as PipelineJobData;
    const result = await runMediaValidation(data);

    if (!result.valid) {
      // Mark job failed in DB
      const db = getWorkerSupabaseClient();
      if (db) {
        await db
          .from('jobs')
          .update({ status: 'failed', error_message: result.reason })
          .eq('id', data.jobId);
      }
      throw new Error(`Media validation failed: ${result.reason}`);
    }

    // Validation passed → fan out to video processing
    await videoProcessingQueue.add('video-processing', data, {
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: 50
    });

    return result;
  },
  defaultWorkerOptions
);
attachFailedHook(mediaValidationWorker, 'media_validation');

// ── 1. Video processing ───────────────────────────────────────────────────────
const videoProcessingWorker = new Worker(
  videoProcessingQueue.name,
  async (job) => {
    const data = job.data as PipelineJobData;
    const output = await runVideoProcessing(data);
    await aiGenerationQueue.add('ai-generate', { ...data, personSourceUrl: output.normalizedSourceUrl });
    return output;
  },
  defaultWorkerOptions
);
attachFailedHook(videoProcessingWorker, 'video_processing');

const aiGenerationWorker = new Worker(
  aiGenerationQueue.name,
  async (job) => {
    const data = job.data as PipelineJobData;
    const output = await runAiGeneration(data);
    await socialPublishingQueue.add('social-publish', data);
    return output;
  },
  defaultWorkerOptions
);
attachFailedHook(aiGenerationWorker, 'ai_generation');

const socialPublishingWorker = new Worker(
  socialPublishingQueue.name,
  async (job) => {
    const data = job.data as PipelineJobData;
    const output = await runSocialPublishing(data);
    return output;
  },
  defaultWorkerOptions
);
attachFailedHook(socialPublishingWorker, 'social_publishing');

new Worker(
  adsBoostQueue.name,
  async (job) => {
    const payload = job.data as {
      postId: string;
      platform: string;
      budget: number;
      durationDays: number;
      objective: 'REACH' | 'VIDEO_VIEWS';
      userId?: string;
    };
    return runAdsBoost(payload);
  },
  defaultWorkerOptions
);

new Worker(
  analyticsSyncQueue.name,
  async (job) => {
    if (job.name === 'analytics-sync-sweep') {
      return runAnalyticsSweep();
    }

    const payload = job.data as {
      userId: string;
      publishedPostId: string;
      platforms: string[];
    };
    return runAnalyticsSync(payload);
  },
  defaultWorkerOptions
);

void ensureAnalyticsSyncScheduler();

console.log('Worker online: media_validation, video_processing, ai_generation, social_publishing, ads_boost, analytics_sync (scheduled)');

async function shutdown() {
  await closeQueues();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
