import { NextResponse } from 'next/server';
import { getJobs } from '../../../../lib/jobs-repository';
import { requireRequestUser } from '../../../../lib/request-auth';

export async function GET(request: Request) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const jobs = await getJobs(authResult.auth.userId);
  return NextResponse.json({ jobs });
}
