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
    console.warn(`[X OAuth] User denied or error: ${error}`);
    return NextResponse.redirect(new URL('/?error=x_oauth_failed', req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', req.url));
  }

  // TODO: Exchange code for access_token via X OAuth2
  const fakeAccessToken = `x-stub-${Date.now()}`;
  const fakeRefreshToken = null;
  const expiresAt = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000); // 120 days

  await storePlatformToken(authResult.auth.userId, 'x', fakeAccessToken, fakeRefreshToken, expiresAt);

  return NextResponse.redirect(new URL('/?success=x_connected', req.url));
}
