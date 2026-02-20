import type { PublishInput, PublishResult, SocialPublishingAdapter } from './social-publisher';

/** Stub publisher used for unknown / unsupported platforms */
export class FallbackPublishingAdapter implements SocialPublishingAdapter {
  name = 'fallback-publisher';
  platform = 'fallback';

  isConfigured(): boolean {
    return false;
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    return {
      platform: input.caption ? 'unknown' : 'unknown',
      externalPostId: `fallback-${input.jobId}`,
      url: `https://example.com/posts/fallback-${input.jobId}`
    };
  }
}
