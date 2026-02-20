import type { AnalyticsFetchInput, AnalyticsProviderAdapter, AnalyticsSample } from './analytics-provider';

export class FallbackAnalyticsProvider implements AnalyticsProviderAdapter {
  name = 'fallback-analytics';
  platform = 'fallback';

  isConfigured(): boolean {
    return false;
  }

  async fetchPostMetrics(_input: AnalyticsFetchInput): Promise<AnalyticsSample> {
    return {
      platform: 'unknown',
      views: Math.floor(Math.random() * 500),
      likes: Math.floor(Math.random() * 150),
      shares: Math.floor(Math.random() * 40),
      comments: Math.floor(Math.random() * 30),
      clicks: Math.floor(Math.random() * 80),
      reach: Math.floor(Math.random() * 1000)
    };
  }
}
