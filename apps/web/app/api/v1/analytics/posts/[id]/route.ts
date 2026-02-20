import { NextResponse } from 'next/server';
import { requireRequestUser } from '../../../../../../lib/request-auth';
import { listAnalyticsByPost } from '../../../../../../lib/analytics-repository';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  const points = await listAnalyticsByPost(authResult.auth.userId, id);

  return NextResponse.json({ postId: id, points });
}
