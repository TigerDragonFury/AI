import type { AnalyticsFetchInput, AnalyticsProviderAdapter, AnalyticsSample } from './analytics-provider';

export class MockAnalyticsProvider implements AnalyticsProviderAdapter {
  name = 'mock-analytics';
  platform = 'mock';

  isConfigured(): boolean {
    return true;
  }

  async fetchPostMetrics(_input: AnalyticsFetchInput): Promise<AnalyticsSample> {
    return {
      platform: 'mock',
      views: Math.floor(Math.random() * 1000),
      likes: Math.floor(Math.random() * 300),
      shares: Math.floor(Math.random() * 80),
      comments: Math.floor(Math.random() * 50),
      clicks: Math.floor(Math.random() * 120),
      reach: Math.floor(Math.random() * 2000)
    };
  }
}
