import { NextResponse } from 'next/server';
import { requireRequestUser } from '../../../../../lib/request-auth';
import { getUserSubscription } from '../../../../../lib/subscription-repository';

export async function GET(request: Request) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const subscription = await getUserSubscription(authResult.auth.userId);
  return NextResponse.json(subscription);
}
