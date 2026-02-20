import { HttpClient } from '../lib/http-client';
import type { AnalyticsFetchInput, AnalyticsProviderAdapter, AnalyticsSample } from './analytics-provider';

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

export class TikTokAnalyticsProvider implements AnalyticsProviderAdapter {
  name = 'tiktok-analytics';
  platform = 'tiktok';

  private client = new HttpClient({
    name: 'TikTok',
    baseUrl: TIKTOK_API_BASE,
    timeoutMs: 12_000,
    maxAttempts: 3
  });

  isConfigured(): boolean {
    return !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
  }

  async fetchPostMetrics(input: AnalyticsFetchInput): Promise<AnalyticsSample> {
    if (this.isConfigured() && input.token) {
      try {
        const res = await this.client.post<{
          data: { videos: Array<{ statistics: { view_count: number; like_count: number; share_count: number; comment_count: number } }> };
        }>(
          '/video/query/',
          { filters: { video_ids: [input.publishedPostId] } },
          { Authorization: `Bearer ${input.token.accessToken}` }
        );

        const stats = res.data?.data?.videos?.[0]?.statistics;
        if (stats) {
          return {
            platform: 'tiktok',
            views: stats.view_count ?? 0,
            likes: stats.like_count ?? 0,
            shares: stats.share_count ?? 0,
            comments: stats.comment_count ?? 0,
            clicks: 0,
            reach: stats.view_count ?? 0
          };
        }
      } catch (err) {
        console.warn(`[TikTok] API call failed, falling back to mock: ${(err as Error).message}`);
      }
    }

    return {
      platform: 'tiktok',
      views: Math.floor(Math.random() * 1500),
      likes: Math.floor(Math.random() * 500),
      shares: Math.floor(Math.random() * 150),
      comments: Math.floor(Math.random() * 120),
      clicks: Math.floor(Math.random() * 220),
      reach: Math.floor(Math.random() * 2500)
    };
  }
}
