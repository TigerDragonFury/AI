/**
 * OAuth "start" routes – redirect the user's browser to the platform's
 * authorization page with the correct client_id, redirect_uri and scopes.
 *
 * The callback is handled by /api/v1/oauth/[platform]/callback/route.ts
 * which stores the resulting access token in platform_tokens.
 */

import { type NextRequest, NextResponse } from 'next/server';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

export const PLATFORM_OAUTH_CONFIGS = {
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize',
    clientKey: process.env.TIKTOK_CLIENT_KEY ?? '',
    scope: 'user.info.basic,video.list,video.publish',
    callbackPath: '/api/v1/oauth/tiktok/callback'
  },
  meta: {
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    clientKey: process.env.META_APP_ID ?? '',
    scope: 'instagram_basic,instagram_content_publish,pages_read_engagement',
    callbackPath: '/api/v1/oauth/meta/callback'
  },
  x: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    clientKey: process.env.TWITTER_API_KEY ?? '',
    scope: 'tweet.read tweet.write users.read offline.access',
    callbackPath: '/api/v1/oauth/x/callback'
  },
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientKey: process.env.YOUTUBE_CLIENT_ID ?? '',
    scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    callbackPath: '/api/v1/oauth/youtube/callback'
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    clientKey: process.env.LINKEDIN_CLIENT_ID ?? '',
    scope: 'r_liteprofile,r_emailaddress,w_member_social',
    callbackPath: '/api/v1/oauth/linkedin/callback'
  }
} as const;

export type OAuthPlatform = keyof typeof PLATFORM_OAUTH_CONFIGS;

export function buildOAuthStartUrl(platform: OAuthPlatform): string | null {
  const config = PLATFORM_OAUTH_CONFIGS[platform];
  if (!config.clientKey) return null;

  const redirectUri = `${APP_URL}${config.callbackPath}`;
  const params = new URLSearchParams({
    client_id: config.clientKey,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scope
  });

  // TikTok uses `client_key` instead of `client_id`
  if (platform === 'tiktok') {
    params.delete('client_id');
    params.set('client_key', config.clientKey);
  }

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Generic GET handler usable by each platform start route.
 * Redirects to the platform's authorization URL or returns an error
 * if the required env var is not set.
 */
export function makeOAuthStartHandler(platform: OAuthPlatform) {
  return async function GET(_req: NextRequest) {
    const url = buildOAuthStartUrl(platform);
    if (!url) {
      return NextResponse.json(
        { error: `${platform} OAuth is not configured. Set the required env vars.` },
        { status: 503 }
      );
    }
    return NextResponse.redirect(url);
  };
}
