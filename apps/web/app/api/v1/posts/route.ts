import { NextResponse } from 'next/server';
import { listPublishedPostsByUser } from '../../../../lib/platform-store';
import { requireRequestUser } from '../../../../lib/request-auth';

export async function GET(request: Request) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const posts = await listPublishedPostsByUser(authResult.auth.userId);
  return NextResponse.json({ posts });
}
