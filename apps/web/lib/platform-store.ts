import { getSupabaseServerClient, isSupabaseConfigured } from './supabase-server';

export type PublishedPost = {
  id: string;
  userId: string;
  jobId: string;
  platforms: string[];
  status: 'scheduled' | 'published';
  scheduleAt?: string;
  createdAt: string;
};

export type AdCampaign = {
  id: string;
  userId: string;
  postId: string;
  budget: number;
  durationDays: number;
  objective: 'REACH' | 'VIDEO_VIEWS';
  createdAt: string;
};

const posts: PublishedPost[] = [];
const campaigns: AdCampaign[] = [];

function mapPostRow(row: Record<string, unknown>): PublishedPost {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    jobId: String(row.job_id),
    platforms: Array.isArray(row.platforms) ? row.platforms.map((item) => String(item)) : [],
    status: String(row.status) as PublishedPost['status'],
    scheduleAt: row.schedule_at ? String(row.schedule_at) : undefined,
    createdAt: String(row.created_at)
  };
}

function mapCampaignRow(row: Record<string, unknown>): AdCampaign {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    postId: String(row.published_post_id),
    budget: Number(row.budget ?? 0),
    durationDays: Number(row.duration_days ?? 0),
    objective: String(row.objective) as AdCampaign['objective'],
    createdAt: String(row.created_at)
  };
}

export async function addPublishedPost(input: Omit<PublishedPost, 'id' | 'createdAt'>) {
  const row: PublishedPost = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input
  };

  if (!isSupabaseConfigured()) {
    posts.unshift(row);
    return row;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    posts.unshift(row);
    return row;
  }

  const { data } = await client
    .from('published_post_groups')
    .insert({
      id: row.id,
      user_id: row.userId,
      job_id: row.jobId,
      platforms: row.platforms,
      status: row.status,
      schedule_at: row.scheduleAt
    })
    .select('*')
    .single();

  if (!data) {
    posts.unshift(row);
    return row;
  }

  return mapPostRow(data as Record<string, unknown>);
}

export async function listPublishedPostsByUser(userId: string) {
  if (!isSupabaseConfigured()) {
    return posts.filter((post) => post.userId === userId);
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return posts.filter((post) => post.userId === userId);
  }

  const { data } = await client
    .from('published_post_groups')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!data) {
    return posts.filter((post) => post.userId === userId);
  }

  return data.map((row: unknown) => mapPostRow(row as Record<string, unknown>));
}

export async function getPublishedPostById(id: string, userId: string) {
  if (!isSupabaseConfigured()) {
    return posts.find((post) => post.id === id && post.userId === userId);
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return posts.find((post) => post.id === id && post.userId === userId);
  }

  const { data } = await client
    .from('published_post_groups')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!data) {
    return posts.find((post) => post.id === id && post.userId === userId);
  }

  return mapPostRow(data as Record<string, unknown>);
}

export async function addCampaign(input: Omit<AdCampaign, 'id' | 'createdAt'>) {
  const row: AdCampaign = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input
  };

  if (!isSupabaseConfigured()) {
    campaigns.unshift(row);
    return row;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    campaigns.unshift(row);
    return row;
  }

  const { data } = await client
    .from('ad_campaigns')
    .insert({
      id: row.id,
      user_id: row.userId,
      published_post_id: row.postId,
      budget: row.budget,
      duration_days: row.durationDays,
      objective: row.objective,
      campaign_id: `${row.postId}-${row.objective.toLowerCase()}`,
      platform: 'multi'
    })
    .select('*')
    .single();

  if (!data) {
    campaigns.unshift(row);
    return row;
  }

  return mapCampaignRow(data as Record<string, unknown>);
}

export async function listCampaignsByUser(userId: string) {
  if (!isSupabaseConfigured()) {
    return campaigns.filter((campaign) => campaign.userId === userId);
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return campaigns.filter((campaign) => campaign.userId === userId);
  }

  const { data } = await client
    .from('ad_campaigns')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!data) {
    return campaigns.filter((campaign) => campaign.userId === userId);
  }

  return data.map((row: unknown) => mapCampaignRow(row as Record<string, unknown>));
}
