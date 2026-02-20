import { HttpClient } from '../lib/http-client';
import type { AnalyticsFetchInput, AnalyticsProviderAdapter, AnalyticsSample } from './analytics-provider';

const META_GRAPH_BASE = 'https://graph.facebook.com/v19.0';

export class MetaAnalyticsProvider implements AnalyticsProviderAdapter {
  name = 'meta-analytics';
  platform = 'meta';

  private client = new HttpClient({
    name: 'Meta',
    baseUrl: META_GRAPH_BASE,
    timeoutMs: 12_000,
    maxAttempts: 3
  });

  isConfigured(): boolean {
    return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
  }

  async fetchPostMetrics(input: AnalyticsFetchInput): Promise<AnalyticsSample> {
    if (this.isConfigured() && input.token) {
      try {
        const res = await this.client.get<{
          impressions?: { value: number };
          reach?: { value: number };
          likes?: { value: number };
          comments?: { value: number };
          shares?: { value: number };
          video_views?: { value: number };
        }>(
          `/${input.publishedPostId}/insights`,
          {
            metric: 'impressions,reach,likes,comments,shares,video_views',
            access_token: input.token.accessToken
          }
        );

        return {
          platform: 'meta',
          views: res.data?.video_views?.value ?? res.data?.impressions?.value ?? 0,
          likes: res.data?.likes?.value ?? 0,
          shares: res.data?.shares?.value ?? 0,
          comments: res.data?.comments?.value ?? 0,
          clicks: 0,
          reach: res.data?.reach?.value ?? 0
        };
      } catch (err) {
        console.warn(`[Meta] API call failed, falling back to mock: ${(err as Error).message}`);
      }
    }

    return {
      platform: 'meta',
      views: Math.floor(Math.random() * 1300),
      likes: Math.floor(Math.random() * 420),
      shares: Math.floor(Math.random() * 100),
      comments: Math.floor(Math.random() * 80),
      clicks: Math.floor(Math.random() * 180),
      reach: Math.floor(Math.random() * 2300)
    };
  }
}
