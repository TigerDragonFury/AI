import { NextResponse } from 'next/server';
import { requireRequestUser } from '../../../../../lib/request-auth';
import { listAnalyticsByPost } from '../../../../../lib/analytics-repository';
import { listCampaignsByUser, listPublishedPostsByUser } from '../../../../../lib/platform-store';

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeCsv).join(',');
}

export async function GET(request: Request) {
  const authResult = await requireRequestUser(request);
  if (!authResult.ok) {
    return authResult.response;
  }
  const { userId } = authResult.auth;

  const [posts, campaigns] = await Promise.all([
    listPublishedPostsByUser(userId),
    listCampaignsByUser(userId)
  ]);

  // Gather analytics for all posts
  const allAnalytics = (
    await Promise.all(posts.map((p) => listAnalyticsByPost(userId, p.id)))
  ).flat();

  const lines: string[] = [];

  // ── Analytics rows ─────────────────────────────────────────────────────────
  lines.push('Section,Post ID,Platform,Captured At,Views,Likes,Shares,Comments,Clicks,Reach');
  for (const pt of allAnalytics) {
    lines.push(
      toCsvRow([
        'analytics',
        pt.publishedPostId,
        pt.platform,
        pt.capturedAt,
        pt.views,
        pt.likes,
        pt.shares,
        pt.comments,
        pt.clicks,
        pt.reach
      ])
    );
  }

  lines.push('');

  // ── Campaign rows ──────────────────────────────────────────────────────────
  lines.push('Section,Campaign ID,Post ID,Objective,Budget (USD),Duration (days),Created At');
  for (const c of campaigns) {
    lines.push(
      toCsvRow([
        'campaign',
        c.id,
        c.postId,
        c.objective,
        c.budget,
        c.durationDays,
        c.createdAt
      ])
    );
  }

  const csv = lines.join('\n');
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ai-ad-analytics-${date}.csv"`,
      'Cache-Control': 'no-store'
    }
  });
}
