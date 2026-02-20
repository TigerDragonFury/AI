import { normalizePlatform, type AnalyticsProviderAdapter } from './analytics-provider';
import { FallbackAnalyticsProvider } from './fallback-analytics-provider';
import { LinkedInAnalyticsProvider } from './linkedin-analytics-provider';
import { MetaAnalyticsProvider } from './meta-analytics-provider';
import { TikTokAnalyticsProvider } from './tiktok-analytics-provider';
import { XAnalyticsProvider } from './x-analytics-provider';
import { YouTubeAnalyticsProvider } from './youtube-analytics-provider';

const providers: Record<string, AnalyticsProviderAdapter> = {
  tiktok: new TikTokAnalyticsProvider(),
  meta: new MetaAnalyticsProvider(),
  x: new XAnalyticsProvider(),
  youtube: new YouTubeAnalyticsProvider(),
  linkedin: new LinkedInAnalyticsProvider()
};

const fallback = new FallbackAnalyticsProvider();

export function getAnalyticsProviderForPlatform(platform: string) {
  const normalized = normalizePlatform(platform);
  return providers[normalized] ?? fallback;
}
