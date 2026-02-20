import { type CreateJobInput, type JobRecord } from '@packages/shared';
import { getSupabaseServerClient, isSupabaseConfigured } from './supabase-server';

type StoredMemoryJob = JobRecord & { userId: string };
const memoryJobs: StoredMemoryJob[] = [];

function mapDbRowToJob(row: Record<string, unknown>): JobRecord {
  const targetPlatformsRaw = row.target_platforms;
  const targetPlatforms = Array.isArray(targetPlatformsRaw)
    ? targetPlatformsRaw.map((item) => String(item))
    : [];

  return {
    id: String(row.id),
    userId: String(row.user_id),
    createdAt: String(row.created_at),
    status: String(row.status) as JobRecord['status'],
    personSourceType: String(row.person_source_type) as JobRecord['personSourceType'],
    personSourceName: String(row.person_source_name),
    personSourceUrl: row.person_source_url ? String(row.person_source_url) : undefined,
    productPhotoName: row.product_photo_name ? String(row.product_photo_name) : undefined,
    productPhotoUrl: row.product_photo_url ? String(row.product_photo_url) : undefined,
    productDescription: row.product_description ? String(row.product_description) : undefined,
    tone: row.tone ? String(row.tone) : undefined,
    targetPlatforms: targetPlatforms as JobRecord['targetPlatforms'],
    generatedVideoUrl: row.generated_video_url ? String(row.generated_video_url) : undefined,
    caption: row.caption ? String(row.caption) : undefined,
    errorMessage: row.error_message ? String(row.error_message) : undefined
  };
}

export async function createJob(input: CreateJobInput, userId: string): Promise<JobRecord> {
  const now = new Date().toISOString();
  const base: JobRecord = {
    id: crypto.randomUUID(),
    userId,
    createdAt: now,
    status: 'queued',
    personSourceType: input.personSourceType,
    personSourceName: input.personSourceName,
    personSourceUrl: input.personSourceUrl,
    productPhotoName: input.productPhotoName,
    productPhotoUrl: input.productPhotoUrl,
    productDescription: input.productDescription,
    tone: input.tone,
    targetPlatforms: input.targetPlatforms
  };

  if (!isSupabaseConfigured()) {
    memoryJobs.unshift({ ...base, userId });
    return base;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    memoryJobs.unshift({ ...base, userId });
    return base;
  }

  const { data, error } = await client
    .from('jobs')
    .insert({
      id: base.id,
      user_id: userId,
      status: base.status,
      person_source_type: base.personSourceType,
      person_source_name: base.personSourceName,
      person_source_url: base.personSourceUrl,
      product_photo_name: base.productPhotoName,
      product_photo_url: base.productPhotoUrl,
      product_description: base.productDescription,
      tone: base.tone,
      target_platforms: base.targetPlatforms
    })
    .select('*')
    .single();

  if (error || !data) {
    memoryJobs.unshift({ ...base, userId });
    return base;
  }

  return mapDbRowToJob(data as Record<string, unknown>);
}

export async function getJobs(userId: string): Promise<JobRecord[]> {
  if (!isSupabaseConfigured()) {
    return memoryJobs.filter((job) => job.userId === userId);
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return memoryJobs.filter((job) => job.userId === userId);
  }

  const { data, error } = await client
    .from('jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) {
    return memoryJobs.filter((job) => job.userId === userId);
  }

  return data.map((row: unknown) => mapDbRowToJob(row as Record<string, unknown>));
}

export async function updateJobStatus(id: string, status: JobRecord['status'], userId: string) {
  const memoryHit = memoryJobs.find((job) => job.id === id && job.userId === userId);
  if (memoryHit) {
    memoryHit.status = status;
  }

  if (!isSupabaseConfigured()) {
    return memoryHit;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return memoryHit;
  }

  const { data } = await client
    .from('jobs')
    .update({ status })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (!data) {
    return memoryHit;
  }

  return mapDbRowToJob(data as Record<string, unknown>);
}

export async function getJobById(id: string, userId: string): Promise<JobRecord | undefined> {
  const memoryHit = memoryJobs.find((job) => job.id === id && job.userId === userId);

  if (!isSupabaseConfigured()) {
    return memoryHit;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return memoryHit;
  }

  const { data } = await client.from('jobs').select('*').eq('id', id).eq('user_id', userId).single();
  if (!data) {
    return memoryHit;
  }

  return mapDbRowToJob(data as Record<string, unknown>);
}
