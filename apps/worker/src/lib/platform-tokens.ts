/**
 * Reads and refreshes OAuth tokens stored in the platform_tokens table.
 *
 * The worker uses service-role credentials so it bypasses RLS – each
 * adapter passes `userId + platform` and gets back the relevant token
 * pair (access / refresh / expiry). A simple in-memory TTL cache avoids
 * hitting the DB on every analytics tick.
 */

import { getWorkerSupabaseClient } from './supabase';

export type PlatformToken = {
  id: string;
  userId: string;
  platform: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
};

// Cache tokens for 5 min to avoid hitting DB on every single job
const tokenCache = new Map<string, { token: PlatformToken; fetchedAt: number }>();
const TOKEN_TTL_MS = 5 * 60 * 1000;

function cacheKey(userId: string, platform: string) {
  return `${userId}::${platform}`;
}

/**
 * Returns the stored OAuth token for `userId + platform`, or null if
 * no token is stored (user hasn't connected the platform yet).
 */
export async function getPlatformToken(
  userId: string,
  platform: string
): Promise<PlatformToken | null> {
  const key = cacheKey(userId, platform);
  const cached = tokenCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < TOKEN_TTL_MS) {
    return cached.token;
  }

  const client = getWorkerSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('platform_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const token: PlatformToken = {
    id: data.id,
    userId: data.user_id,
    platform: data.platform,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_at ? new Date(data.expires_at) : null
  };

  tokenCache.set(key, { token, fetchedAt: Date.now() });
  return token;
}

/**
 * Persists an updated access/refresh token pair (e.g. after an OAuth
 * refresh flow).  Also updates the in-memory cache.
 */
export async function upsertPlatformToken(
  userId: string,
  platform: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date | null
): Promise<void> {
  const client = getWorkerSupabaseClient();
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

  await client
    .from('platform_tokens')
    .upsert(row, { onConflict: 'id' });

  // Update cache
  const token: PlatformToken = {
    id: row.id,
    userId,
    platform,
    accessToken,
    refreshToken,
    expiresAt
  };
  tokenCache.set(cacheKey(userId, platform), { token, fetchedAt: Date.now() });
}

/**
 * Returns true when the token's `expires_at` is within the next 5 minutes
 * (or already expired). Callers should attempt a refresh before using it.
 */
export function isTokenExpiringSoon(token: PlatformToken, bufferMs = 5 * 60 * 1000): boolean {
  if (!token.expiresAt) return false; // tokens without expiry are long-lived
  return token.expiresAt.getTime() - Date.now() < bufferMs;
}

/** Evict cached entry – useful after a failed request that suggests the token is invalid */
export function invalidateTokenCache(userId: string, platform: string) {
  tokenCache.delete(cacheKey(userId, platform));
}
