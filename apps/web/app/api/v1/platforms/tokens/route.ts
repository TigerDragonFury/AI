import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '../../../../../lib/request-auth';
import { listPlatformTokens } from '../../../../../lib/platform-tokens-repository';

export async function GET(req: NextRequest) {
  const authResult = await requireRequestUser(req);
  if (!authResult.ok) {
    return authResult.response;
  }

  const tokens = await listPlatformTokens(authResult.auth.userId);
  return NextResponse.json({ tokens });
}
