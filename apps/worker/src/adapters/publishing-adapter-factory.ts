import { normalizePlatform } from './analytics-provider';
import { FallbackPublishingAdapter } from './fallback-publishing-adapter';
import { LinkedInPublishingAdapter } from './linkedin-publishing-adapter';
import { MetaPublishingAdapter } from './meta-publishing-adapter';
import type { SocialPublishingAdapter } from './social-publisher';
import { TikTokPublishingAdapter } from './tiktok-publishing-adapter';
import { XPublishingAdapter } from './x-publishing-adapter';
import { YouTubePublishingAdapter } from './youtube-publishing-adapter';

const adapters: Record<string, SocialPublishingAdapter> = {
  tiktok: new TikTokPublishingAdapter(),
  meta: new MetaPublishingAdapter(),
  x: new XPublishingAdapter(),
  youtube: new YouTubePublishingAdapter(),
  linkedin: new LinkedInPublishingAdapter()
};

const fallback = new FallbackPublishingAdapter();

export function getPublishingAdapterForPlatform(platform: string): SocialPublishingAdapter {
  const normalized = normalizePlatform(platform);
  return adapters[normalized] ?? fallback;
}
