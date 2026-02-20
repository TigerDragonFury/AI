import type { AdsBoostAdapter } from './ads-boost-adapter';
import { normalizePlatform } from './analytics-provider';
import { FallbackBoostAdapter } from './fallback-boost-adapter';
import { LinkedInBoostAdapter } from './linkedin-boost-adapter';
import { MetaBoostAdapter } from './meta-boost-adapter';
import { TikTokBoostAdapter } from './tiktok-boost-adapter';
import { XBoostAdapter } from './x-boost-adapter';
import { YouTubeBoostAdapter } from './youtube-boost-adapter';

const adapters: Record<string, AdsBoostAdapter> = {
  tiktok: new TikTokBoostAdapter(),
  meta: new MetaBoostAdapter(),
  x: new XBoostAdapter(),
  youtube: new YouTubeBoostAdapter(),
  linkedin: new LinkedInBoostAdapter()
};

const fallback = new FallbackBoostAdapter();

export function getBoostAdapterForPlatform(platform: string): AdsBoostAdapter {
  const normalized = normalizePlatform(platform);
  return adapters[normalized] ?? fallback;
}
