import { HttpClient } from '../lib/http-client';
import type { AnalyticsFetchInput, AnalyticsProviderAdapter, AnalyticsSample } from './analytics-provider';

const LI_API_BASE = 'https://api.linkedin.com/v2';

export class LinkedInAnalyticsProvider implements AnalyticsProviderAdapter {
  name = 'linkedin-analytics';
  platform = 'linkedin';

  private client = new HttpClient({
    name: 'LinkedIn',
    baseUrl: LI_API_BASE,
    timeoutMs: 10_000,
    maxAttempts: 3
  });

  isConfigured(): boolean {
    return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
  }

  async fetchPostMetrics(input: AnalyticsFetchInput): Promise<AnalyticsSample> {
    if (this.isConfigured() && input.token) {
      try {
        const res = await this.client.get<{
          elements?: Array<{ totalShareStatistics?: { impressionCount: number; likeCount: number; shareCount: number; commentCount: number; clickCount: number; uniqueImpressionsCount: number } }>;
        }>(
          '/organizationalEntityShareStatistics',
          { q: 'organizationalEntity', shares: `urn:li:share:${input.publishedPostId}` },
          { Authorization: `Bearer ${input.token.accessToken}` }
        );

        const s = res.data?.elements?.[0]?.totalShareStatistics;
        if (s) {
          return {
            platform: 'linkedin',
            views: s.impressionCount ?? 0,
            likes: s.likeCount ?? 0,
            shares: s.shareCount ?? 0,
            comments: s.commentCount ?? 0,
            clicks: s.clickCount ?? 0,
            reach: s.uniqueImpressionsCount ?? s.impressionCount ?? 0
          };
        }
      } catch (err) {
        console.warn(`[LinkedIn] API call failed, falling back to mock: ${(err as Error).message}`);
      }
    }

    return {
      platform: 'linkedin',
      views: Math.floor(Math.random() * 700),
      likes: Math.floor(Math.random() * 220),
      shares: Math.floor(Math.random() * 60),
      comments: Math.floor(Math.random() * 50),
      clicks: Math.floor(Math.random() * 100),
      reach: Math.floor(Math.random() * 1400)
    };
  }
}
