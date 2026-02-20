import { getSupabaseServerClient, isSupabaseConfigured } from './supabase-server';

export type AnalyticsPoint = {
  id: string;
  userId: string;
  publishedPostId: string;
  platform: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  clicks: number;
  reach: number;
  capturedAt: string;
};

const memoryAnalytics: AnalyticsPoint[] = [];

function mapAnalyticsRow(row: Record<string, unknown>): AnalyticsPoint {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    publishedPostId: String(row.published_post_id),
    platform: String(row.platform),
    views: Number(row.views ?? 0),
    likes: Number(row.likes ?? 0),
    shares: Number(row.shares ?? 0),
    comments: Number(row.comments ?? 0),
    clicks: Number(row.clicks ?? 0),
    reach: Number(row.reach ?? 0),
    capturedAt: String(row.captured_at)
  };
}

export async function addAnalyticsPoint(
  input: Omit<AnalyticsPoint, 'id' | 'capturedAt'> & { capturedAt?: string }
) {
  const row: AnalyticsPoint = {
    id: crypto.randomUUID(),
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    ...input
  };

  if (!isSupabaseConfigured()) {
    memoryAnalytics.unshift(row);
    return row;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    memoryAnalytics.unshift(row);
    return row;
  }

  const { data } = await client
    .from('analytics')
    .insert({
      id: row.id,
      user_id: row.userId,
      published_post_id: row.publishedPostId,
      platform: row.platform,
      views: row.views,
      likes: row.likes,
      shares: row.shares,
      comments: row.comments,
      clicks: row.clicks,
      reach: row.reach,
      captured_at: row.capturedAt
    })
    .select('*')
    .single();

  if (!data) {
    memoryAnalytics.unshift(row);
    return row;
  }

  return mapAnalyticsRow(data as Record<string, unknown>);
}

export async function listAnalyticsByPost(userId: string, postId: string) {
  if (!isSupabaseConfigured()) {
    return memoryAnalytics.filter((item) => item.userId === userId && item.publishedPostId === postId);
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return memoryAnalytics.filter((item) => item.userId === userId && item.publishedPostId === postId);
  }

  const { data } = await client
    .from('analytics')
    .select('*')
    .eq('user_id', userId)
    .eq('published_post_id', postId)
    .order('captured_at', { ascending: false })
    .limit(200);

  if (!data) {
    return memoryAnalytics.filter((item) => item.userId === userId && item.publishedPostId === postId);
  }

  return data.map((row: unknown) => mapAnalyticsRow(row as Record<string, unknown>));
}
