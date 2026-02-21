import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '../../../../../../lib/request-auth';
import { storePlatformToken } from '../../../../../../lib/platform-tokens-repository';

/**
 * OAuth callback handler for TikTok.
 *
 * In production, this would exchange the authorization code for an access
 * token, extract expiry info, and store it. For now it's a stub that logs
 * the callback params and redirects back to the dashboard.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  // TikTok reachability probe — no params present, just confirm the URL is live
  if (!code && !error) {
    return new NextResponse('OK', { status: 200 });
  }

  const authResult = await requireRequestUser(req);
  if (!authResult.ok) {
    return NextResponse.redirect(new URL('/?error=unauthorized', req.url));
  }

  if (error) {
    console.warn(`[TikTok OAuth] User denied or error: ${error}`);
    return NextResponse.redirect(new URL('/?error=tiktok_oauth_failed', req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', req.url));
  }

  // TODO: Exchange code for access_token via TikTok OAuth2 token endpoint
  // For now, store a placeholder token
  const fakeAccessToken = `tiktok-stub-${Date.now()}`;
  const fakeRefreshToken = null;
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

  await storePlatformToken(authResult.auth.userId, 'tiktok', fakeAccessToken, fakeRefreshToken, expiresAt);

  return NextResponse.redirect(new URL('/?success=tiktok_connected', req.url));
}
