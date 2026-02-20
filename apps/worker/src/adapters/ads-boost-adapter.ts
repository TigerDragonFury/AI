/**
 * Interface for paid-ads / boost adapters.
 *
 * Each platform implements this contract so the ads-boost pipeline can
 * create a paid promotion campaign for a published post via the
 * platform's Ads API (or fall back to a stub in dev mode).
 */

import type { PlatformToken } from '../lib/platform-tokens';

export type BoostInput = {
  userId: string;
  postId: string;
  platform: string;
  budget: number;
  durationDays: number;
  objective: 'REACH' | 'VIDEO_VIEWS';
  /** OAuth token for the target platform – may be null */
  token: PlatformToken | null;
};

export type BoostResult = {
  platform: string;
  /** Platform-specific campaign ID */
  externalCampaignId: string;
  /** Estimated daily spend */
  dailyBudget: number;
  /** Overall status */
  status: 'CREATED' | 'PENDING_REVIEW' | 'LIVE' | 'STUB';
  meta?: Record<string, unknown>;
};

export interface AdsBoostAdapter {
  name: string;
  platform: string;
  isConfigured(): boolean;
  createCampaign(input: BoostInput): Promise<BoostResult>;
}
