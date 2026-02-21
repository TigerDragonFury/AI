import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseCookieClient, getSupabaseServerClient, isSupabaseConfigured } from '../../../../../../lib/supabase-server';
import { storePlatformToken } from '../../../../../../lib/platform-tokens-repository';

const APP_URL = (process.env.APP_URL ?? 'https://ai-api-delta.vercel.app').replace(/\/$/, '');

/**
 * TikTok OAuth callback. Exchanges the authorization code for an access token
 * and stores it. Uses cookie-based session auth (browser redirect, no Bearer header).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // TikTok reachability probe — no params, just confirm the URL is live
  if (!code && !error) {
    return new NextResponse('OK', { status: 200 });
  }

  if (error) {
    console.warn(`[TikTok OAuth] Error from TikTok: ${error}`);
    return NextResponse.redirect(new URL('/?error=tiktok_oauth_failed', APP_URL));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', APP_URL));
  }

  // --- Get the current user from the browser session cookie ---
  let userId: string | null = null;

  if (isSupabaseConfigured()) {
    try {
      const cookieClient = await getSupabaseCookieClient();
      if (cookieClient) {
        const { data: { user } } = await cookieClient.auth.getUser();
        userId = user?.id ?? null;
      }
    } catch (err) {
      console.error('[TikTok OAuth] Failed to read session from cookies:', err);
    }

    if (!userId) {
      console.warn('[TikTok OAuth] No authenticated user found in session.');
      return NextResponse.redirect(new URL('/?error=unauthorized', APP_URL));
    }
  } else {
    // Dev fallback
    userId = 'dev-user';
  }

  // --- Exchange authorization code for access token ---
  const clientKey = process.env.TIKTOK_CLIENT_KEY ?? '';
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET ?? '';
  const redirectUri = `${APP_URL}/api/v1/oauth/tiktok/callback`;

  let accessToken: string;
  let refreshToken: string | null = null;
  let expiresAt: Date | null = null;

  try {
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }).toString()
    });

    const tokenData = await tokenRes.json();
    console.log('[TikTok OAuth] Token response:', JSON.stringify(tokenData));

    if (tokenData.error) {
      console.error('[TikTok OAuth] Token exchange failed:', tokenData.error, tokenData.error_description);
      return NextResponse.redirect(new URL(`/?error=tiktok_token_failed`, APP_URL));
    }

    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token ?? null;
    const expiresIn: number = tokenData.expires_in ?? 86400;
    expiresAt = new Date(Date.now() + expiresIn * 1000);
  } catch (err) {
    console.error('[TikTok OAuth] Token exchange exception:', err);
    return NextResponse.redirect(new URL('/?error=tiktok_token_exception', APP_URL));
  }

  // --- Store the token ---
  await storePlatformToken(userId, 'tiktok', accessToken, refreshToken, expiresAt);

  return NextResponse.redirect(new URL('/?success=tiktok_connected', APP_URL));
}
