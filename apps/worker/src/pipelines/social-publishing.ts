import { normalizePlatform } from '../adapters/analytics-provider';
import { getPublishingAdapterForPlatform } from '../adapters/publishing-adapter-factory';
import type { PublishResult } from '../adapters/social-publisher';
import { getPlatformToken } from '../lib/platform-tokens';
import { getWorkerSupabaseClient } from '../lib/supabase';
import type { PipelineJobData } from '../types';

/** Resolve the video URL to actually publish: prefer generated ad, fall back to source. */
async function resolveVideoUrl(data: PipelineJobData): Promise<string> {
  const client = getWorkerSupabaseClient();
  if (client) {
    const { data: row } = await client
      .from('jobs')
      .select('generated_video_url, person_source_url')
      .eq('id', data.jobId)
      .single();

    if (row?.generated_video_url) {
      return row.generated_video_url as string;
    }
    if (row?.person_source_url) {
      return row.person_source_url as string;
    }
  }
  return data.personSourceUrl ?? '';
}

export async function runSocialPublishing(data: PipelineJobData) {
  const results: PublishResult[] = [];
  const videoUrl = await resolveVideoUrl(data);

  for (const platform of data.targetPlatforms) {
    const normalized = normalizePlatform(platform);
    const adapter = getPublishingAdapterForPlatform(platform);
    const token = await getPlatformToken(data.userId, normalized);

    const result = await adapter.publish({
      userId: data.userId,
      jobId: data.jobId,
      videoUrl,
      caption: data.productDescription ?? `AI Ad – ${data.jobId}`,
      token
    });

    results.push(result);
  }

  // Persist the published post group
  const client = getWorkerSupabaseClient();
  if (client && results.length) {
    const groupId = crypto.randomUUID();
    await client.from('published_post_groups').insert({
      id: groupId,
      user_id: data.userId,
      job_id: data.jobId,
      platforms: data.targetPlatforms,
      posts: results,
      created_at: new Date().toISOString()
    }).then(({ error }) => {
      if (error) console.warn(`[SocialPublish] Failed to persist post group: ${error.message}`);
    });

    // Mark the job as published in DB
    await client
      .from('jobs')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', data.jobId);
  }

  return results;
}

