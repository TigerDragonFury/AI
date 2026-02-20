import { HttpClient } from '../lib/http-client';
import type { AdsBoostAdapter, BoostInput, BoostResult } from './ads-boost-adapter';

const TIKTOK_ADS_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

export class TikTokBoostAdapter implements AdsBoostAdapter {
  name = 'tiktok-boost';
  platform = 'tiktok';

  private client = new HttpClient({
    name: 'TikTok-Ads',
    baseUrl: TIKTOK_ADS_BASE,
    timeoutMs: 15_000,
    maxAttempts: 2
  });

  isConfigured(): boolean {
    return !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
  }

  async createCampaign(input: BoostInput): Promise<BoostResult> {
    if (this.isConfigured() && input.token) {
      try {
        const res = await this.client.post<{
          data?: { campaign_id: string };
        }>(
          '/campaign/create/',
          {
            campaign_name: `Boost ${input.postId}`,
            objective_type: input.objective === 'REACH' ? 'REACH' : 'VIDEO_VIEWS',
            budget_mode: 'BUDGET_MODE_TOTAL',
            budget: input.budget
          },
          { 'Access-Token': input.token.accessToken }
        );

        return {
          platform: 'tiktok',
          externalCampaignId: res.data?.data?.campaign_id ?? `tt-campaign-${input.postId}`,
          dailyBudget: +(input.budget / input.durationDays).toFixed(2),
          status: 'PENDING_REVIEW'
        };
      } catch (err) {
        console.warn(`[TikTok-Ads] Campaign create failed, returning stub: ${(err as Error).message}`);
      }
    }

    return {
      platform: 'tiktok',
      externalCampaignId: `tt-campaign-${input.postId}`,
      dailyBudget: +(input.budget / input.durationDays).toFixed(2),
      status: 'STUB'
    };
  }
}
