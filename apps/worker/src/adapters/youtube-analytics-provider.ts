import { HttpClient } from '../lib/http-client';
import type { AnalyticsFetchInput, AnalyticsProviderAdapter, AnalyticsSample } from './analytics-provider';

const YT_DATA_BASE = 'https://www.googleapis.com/youtube/v3';

export class YouTubeAnalyticsProvider implements AnalyticsProviderAdapter {
  name = 'youtube-analytics';
  platform = 'youtube';

  private client = new HttpClient({
    name: 'YouTube',
    baseUrl: YT_DATA_BASE,
    timeoutMs: 12_000,
    maxAttempts: 3
  });

  isConfigured(): boolean {
    return !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);
  }

  async fetchPostMetrics(input: AnalyticsFetchInput): Promise<AnalyticsSample> {
    if (this.isConfigured() && input.token) {
      try {
        const res = await this.client.get<{
          items?: Array<{ statistics?: { viewCount: string; likeCount: string; commentCount: string; favoriteCount: string } }>;
        }>(
          '/videos',
          {
            id: input.publishedPostId,
            part: 'statistics',
            access_token: input.token.accessToken
          }
        );

        const stats = res.data?.items?.[0]?.statistics;
        if (stats) {
          return {
            platform: 'youtube',
            views: Number(stats.viewCount) || 0,
            likes: Number(stats.likeCount) || 0,
            shares: 0, // not exposed in Data API v3
            comments: Number(stats.commentCount) || 0,
            clicks: 0,
            reach: Number(stats.viewCount) || 0
          };
        }
      } catch (err) {
        console.warn(`[YouTube] API call failed, falling back to mock: ${(err as Error).message}`);
      }
    }

    return {
      platform: 'youtube',
      views: Math.floor(Math.random() * 1800),
      likes: Math.floor(Math.random() * 600),
      shares: Math.floor(Math.random() * 110),
      comments: Math.floor(Math.random() * 140),
      clicks: Math.floor(Math.random() * 240),
      reach: Math.floor(Math.random() * 3000)
    };
  }
}
