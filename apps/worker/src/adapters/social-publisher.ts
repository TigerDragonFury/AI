/**
 * Interface for social-media publishing adapters.
 *
 * Each platform implements this contract so the social-publishing pipeline
 * can publish a generated video ad to the connected account via the
 * platform's API (or fall back to a stub in dev mode).
 */

import type { PlatformToken } from '../lib/platform-tokens';

export type PublishInput = {
  userId: string;
  jobId: string;
  /** Public URL (or signed URL) of the generated video */
  videoUrl: string;
  /** Caption / description text */
  caption: string;
  /** OAuth token for the target platform – may be null */
  token: PlatformToken | null;
};

export type PublishResult = {
  platform: string;
  /** Platform-specific post / video ID */
  externalPostId: string;
  /** Public URL where the post can be viewed */
  url: string;
  /** Extra metadata returned by the platform */
  meta?: Record<string, unknown>;
};

export interface SocialPublishingAdapter {
  name: string;
  platform: string;
  /** True when the adapter's required env vars are set */
  isConfigured(): boolean;
  publish(input: PublishInput): Promise<PublishResult>;
}
