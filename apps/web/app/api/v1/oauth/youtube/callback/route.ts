import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '../../../../../../lib/request-auth';
import { storePlatformToken } from '../../../../../../lib/platform-tokens-repository';

export async function GET(req: NextRequest) {
  const authResult = await requireRequestUser(req);
  if (!authResult.ok) {
    return NextResponse.redirect(new URL('/?error=unauthorized', req.url));
  }

  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  if (error) {
    console.warn(`[YouTube OAuth] User denied or error: ${error}`);
    return NextResponse.redirect(new URL('/?error=youtube_oauth_failed', req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', req.url));
  }

  // TODO: Exchange code for access_token via Google OAuth2
  const fakeAccessToken = `youtube-stub-${Date.now()}`;
  const fakeRefreshToken = `youtube-refresh-stub`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour (YouTube tokens are short-lived, use refresh)

  await storePlatformToken(authResult.auth.userId, 'youtube', fakeAccessToken, fakeRefreshToken, expiresAt);

  return NextResponse.redirect(new URL('/?success=youtube_connected', req.url));
}
