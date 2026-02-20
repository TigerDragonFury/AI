import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '../../../../../../lib/request-auth';
import { disconnectPlatformToken } from '../../../../../../lib/platform-tokens-repository';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const authResult = await requireRequestUser(req);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { platform } = await params;
  await disconnectPlatformToken(authResult.auth.userId, platform);
  return NextResponse.json({ ok: true });
}
