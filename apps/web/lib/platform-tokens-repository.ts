/**
 * Platform token management for web app – allows users to view their
 * connected platforms and disconnect them. OAuth connect flows redirect
 * back through callback handlers that persist tokens via this module.
 */

import { getSupabaseServerClient } from './supabase-server';

export type PlatformTokenInfo = {
  id: string;
  platform: string;
  connectedAt: Date;
  expiresAt: Date | null;
};

/**
 * Lists all connected platform tokens for the given user (no sensitive data).
 */
export async function listPlatformTokens(userId: string): Promise<PlatformTokenInfo[]> {
  const client = getSupabaseServerClient();
  if (!client) return [];

  const { data, error } = await client
    .from('platform_tokens')
    .select('id, platform, created_at, expires_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    platform: row.platform,
    connectedAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null
  }));
}

/**
 * Disconnects (deletes) a platform token for the given user.
 */
export async function disconnectPlatformToken(userId: string, platform: string): Promise<void> {
  const client = getSupabaseServerClient();
  if (!client) return;

  await client.from('platform_tokens').delete().eq('user_id', userId).eq('platform', platform);
}

/**
 * Stores a platform OAuth token (called from OAuth callback handlers).
 */
export async function storePlatformToken(
  userId: string,
  platform: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date | null
): Promise<void> {
  const client = getSupabaseServerClient();
  if (!client) return;

  const row = {
    id: `${userId}-${platform}`,
    user_id: userId,
    platform,
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt?.toISOString() ?? null,
    updated_at: new Date().toISOString()
  };

  await client.from('platform_tokens').upsert(row, { onConflict: 'id' });
}
