import { NextResponse } from 'next/server';
import { getJobs } from '../../../../../lib/jobs-repository';
import { listCampaignsByUser, listPublishedPostsByUser } from '../../../../../lib/platform-store';
import { requireRequestUser } from '../../../../../lib/request-auth';

export async function GET(request: Request) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const userId = authResult.auth.userId;
  const jobs = await getJobs(userId);
  const posts = await listPublishedPostsByUser(userId);
  const campaigns = await listCampaignsByUser(userId);

  const totalSpend = campaigns.reduce((sum, campaign) => sum + campaign.budget, 0);

  return NextResponse.json({
    totalJobs: jobs.length,
    totalPosts: posts.length,
    totalCampaigns: campaigns.length,
    totalSpend,
    queuedJobs: jobs.filter((job) => job.status === 'queued').length,
    publishedJobs: jobs.filter((job) => job.status === 'published').length
  });
}
