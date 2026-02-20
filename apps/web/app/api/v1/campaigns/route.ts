import { NextResponse } from 'next/server';
import { listCampaignsByUser } from '../../../../lib/platform-store';
import { requireRequestUser } from '../../../../lib/request-auth';

export async function GET(request: Request) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const campaigns = await listCampaignsByUser(authResult.auth.userId);
  return NextResponse.json({ campaigns });
}
