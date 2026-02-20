import { NextResponse } from 'next/server';
import { updateJobStatus } from '../../../../../../lib/jobs-repository';
import { requireRequestUser } from '../../../../../../lib/request-auth';
import { sendJobApprovedEmail } from '../../../../../../lib/email';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  const job = await updateJobStatus(id, 'approved', authResult.auth.userId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Fire-and-forget email notification
  sendJobApprovedEmail(authResult.auth.email, id).catch(() => {
    // non-critical
  });

  return NextResponse.json({ job });
}
