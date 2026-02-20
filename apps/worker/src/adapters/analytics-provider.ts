import type { PlatformToken } from '../lib/platform-tokens';

export type AnalyticsSample = {
  platform: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  clicks: number;
  reach: number;
};

export interface AnalyticsFetchInput {
  userId: string;
  publishedPostId: string;
  /** OAuth token for the platform – null when user hasn't connected yet */
  token: PlatformToken | null;
}

export interface AnalyticsProviderAdapter {
  name: string;
  platform: string;
  /** True when the adapter can call the real API (credentials configured) */
  isConfigured(): boolean;
  fetchPostMetrics(input: AnalyticsFetchInput): Promise<AnalyticsSample>;
}

export function normalizePlatform(value: string) {
  const platform = value.trim().toLowerCase();
  if (platform === 'twitter') {
    return 'x';
  }
  if (platform === 'facebook' || platform === 'instagram') {
    return 'meta';
  }
  return platform;
}
