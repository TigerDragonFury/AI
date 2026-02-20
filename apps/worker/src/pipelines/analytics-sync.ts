import { getAnalyticsProviderForPlatform } from '../adapters/analytics-provider-factory';
import { normalizePlatform } from '../adapters/analytics-provider';
import { getPlatformToken } from '../lib/platform-tokens';
import { getWorkerSupabaseClient } from '../lib/supabase';

export async function runAnalyticsSync(payload: {
  userId: string;
  publishedPostId: string;
  platforms: string[];
}) {
  const metrics = [];

  for (const platform of payload.platforms) {
    const normalized = normalizePlatform(platform);
    const provider = getAnalyticsProviderForPlatform(platform);
    const token = await getPlatformToken(payload.userId, normalized);

    const metric = await provider.fetchPostMetrics({
      userId: payload.userId,
      publishedPostId: payload.publishedPostId,
      token
    });
    metrics.push(metric);
  }

  const client = getWorkerSupabaseClient();
  if (!client) {
    return { mode: 'memory-only', inserted: metrics.length, providers: payload.platforms };
  }

  const rows = metrics.map((metric) => ({
    id: crypto.randomUUID(),
    user_id: payload.userId,
    published_post_id: payload.publishedPostId,
    platform: metric.platform,
    views: metric.views,
    likes: metric.likes,
    shares: metric.shares,
    comments: metric.comments,
    clicks: metric.clicks,
    reach: metric.reach,
    captured_at: new Date().toISOString()
  }));

  const { error } = await client.from('analytics').insert(rows);
  if (error) {
    throw new Error(`Analytics sync insert failed: ${error.message}`);
  }

  return { mode: 'supabase', inserted: rows.length, providers: payload.platforms };
}
