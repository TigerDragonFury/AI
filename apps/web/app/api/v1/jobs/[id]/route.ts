import { NextResponse } from 'next/server';
import { deleteJob } from '../../../../../lib/jobs-repository';
import { requireRequestUser } from '../../../../../lib/request-auth';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  const deleted = await deleteJob(id, authResult.auth.userId);

  if (!deleted) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
