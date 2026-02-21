import { NextResponse } from 'next/server';
import { deleteJob, updateJobCaption } from '../../../../../lib/jobs-repository';
import { requireRequestUser } from '../../../../../lib/request-auth';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  const body = await request.json() as { caption?: string };

  if (typeof body.caption === 'string') {
    await updateJobCaption(id, authResult.auth.userId, body.caption, 'awaiting_approval');
  }

  return NextResponse.json({ success: true });
}

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
