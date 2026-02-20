import { HttpClient } from '../lib/http-client';
import type { AnalyticsFetchInput, AnalyticsProviderAdapter, AnalyticsSample } from './analytics-provider';

const X_API_BASE = 'https://api.x.com/2';

export class XAnalyticsProvider implements AnalyticsProviderAdapter {
  name = 'x-analytics';
  platform = 'x';

  private client = new HttpClient({
    name: 'X',
    baseUrl: X_API_BASE,
    timeoutMs: 10_000,
    maxAttempts: 3
  });

  isConfigured(): boolean {
    return !!(process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET);
  }

  async fetchPostMetrics(input: AnalyticsFetchInput): Promise<AnalyticsSample> {
    if (this.isConfigured() && input.token) {
      try {
        const res = await this.client.get<{
          data?: { public_metrics?: { impression_count: number; like_count: number; retweet_count: number; reply_count: number; bookmark_count: number } };
        }>(
          `/tweets/${input.publishedPostId}`,
          { 'tweet.fields': 'public_metrics' },
          { Authorization: `Bearer ${input.token.accessToken}` }
        );

        const m = res.data?.data?.public_metrics;
        if (m) {
          return {
            platform: 'x',
            views: m.impression_count ?? 0,
            likes: m.like_count ?? 0,
            shares: m.retweet_count ?? 0,
            comments: m.reply_count ?? 0,
            clicks: m.bookmark_count ?? 0,
            reach: m.impression_count ?? 0
          };
        }
      } catch (err) {
        console.warn(`[X] API call failed, falling back to mock: ${(err as Error).message}`);
      }
    }

    return {
      platform: 'x',
      views: Math.floor(Math.random() * 900),
      likes: Math.floor(Math.random() * 260),
      shares: Math.floor(Math.random() * 90),
      comments: Math.floor(Math.random() * 70),
      clicks: Math.floor(Math.random() * 140),
      reach: Math.floor(Math.random() * 1700)
    };
  }
}
