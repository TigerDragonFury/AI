import { HttpClient } from '../lib/http-client';
import type { AdsBoostAdapter, BoostInput, BoostResult } from './ads-boost-adapter';

const X_ADS_BASE = 'https://ads-api.x.com/12';

export class XBoostAdapter implements AdsBoostAdapter {
  name = 'x-boost';
  platform = 'x';

  private client = new HttpClient({
    name: 'X-Ads',
    baseUrl: X_ADS_BASE,
    timeoutMs: 15_000,
    maxAttempts: 2
  });

  isConfigured(): boolean {
    return !!(process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET);
  }

  async createCampaign(input: BoostInput): Promise<BoostResult> {
    if (this.isConfigured() && input.token) {
      try {
        const res = await this.client.post<{
          data?: { id: string };
        }>(
          '/accounts/<account_id>/campaigns',
          {
            name: `Boost ${input.postId}`,
            funding_instrument_id: 'placeholder',
            daily_budget_amount_local_micro: Math.round((input.budget / input.durationDays) * 1_000_000),
            entity_status: 'PAUSED'
          },
          { Authorization: `Bearer ${input.token.accessToken}` }
        );

        return {
          platform: 'x',
          externalCampaignId: res.data?.data?.id ?? `x-campaign-${input.postId}`,
          dailyBudget: +(input.budget / input.durationDays).toFixed(2),
          status: 'PENDING_REVIEW'
        };
      } catch (err) {
        console.warn(`[X-Ads] Campaign create failed, returning stub: ${(err as Error).message}`);
      }
    }

    return {
      platform: 'x',
      externalCampaignId: `x-campaign-${input.postId}`,
      dailyBudget: +(input.budget / input.durationDays).toFixed(2),
      status: 'STUB'
    };
  }
}
