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
    console.warn(`[Meta OAuth] User denied or error: ${error}`);
    return NextResponse.redirect(new URL('/?error=meta_oauth_failed', req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', req.url));
  }

  // TODO: Exchange code for access_token via Meta OAuth2
  const fakeAccessToken = `meta-stub-${Date.now()}`;
  const fakeRefreshToken = null;
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

  await storePlatformToken(authResult.auth.userId, 'meta', fakeAccessToken, fakeRefreshToken, expiresAt);

  return NextResponse.redirect(new URL('/?success=meta_connected', req.url));
}
