import { analyticsSyncQueue } from '../queues';
import { getWorkerSupabaseClient } from '../lib/supabase';

export async function runAnalyticsSweep() {
  const client = getWorkerSupabaseClient();
  if (!client) {
    return { queued: 0, mode: 'no-supabase' as const };
  }

  const { data, error } = await client
    .from('published_post_groups')
    .select('id, user_id, platforms')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error || !data) {
    throw new Error(`Analytics sweep failed to read posts: ${error?.message ?? 'unknown'}`);
  }

  let queued = 0;
  for (const row of data as Array<{ id: string; user_id: string; platforms: string[] }>) {
    await analyticsSyncQueue.add(
      'analytics-sync',
      {
        userId: row.user_id,
        publishedPostId: row.id,
        platforms: Array.isArray(row.platforms) && row.platforms.length ? row.platforms : ['unknown']
      },
      {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: 50
      }
    );
    queued += 1;
  }

  return { queued, mode: 'supabase' as const };
}
