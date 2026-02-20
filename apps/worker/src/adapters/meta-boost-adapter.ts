import { HttpClient } from '../lib/http-client';
import type { AdsBoostAdapter, BoostInput, BoostResult } from './ads-boost-adapter';

const META_ADS_BASE = 'https://graph.facebook.com/v19.0';

export class MetaBoostAdapter implements AdsBoostAdapter {
  name = 'meta-boost';
  platform = 'meta';

  private client = new HttpClient({
    name: 'Meta-Ads',
    baseUrl: META_ADS_BASE,
    timeoutMs: 15_000,
    maxAttempts: 2
  });

  isConfigured(): boolean {
    return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
  }

  async createCampaign(input: BoostInput): Promise<BoostResult> {
    if (this.isConfigured() && input.token) {
      try {
        const res = await this.client.post<{ id?: string }>(
          '/act_<ad_account_id>/campaigns',
          {
            name: `Boost ${input.postId}`,
            objective: input.objective === 'REACH' ? 'OUTCOME_AWARENESS' : 'OUTCOME_ENGAGEMENT',
            status: 'PAUSED',
            special_ad_categories: '[]'
          },
          { Authorization: `Bearer ${input.token.accessToken}` }
        );

        return {
          platform: 'meta',
          externalCampaignId: res.data?.id ?? `meta-campaign-${input.postId}`,
          dailyBudget: +(input.budget / input.durationDays).toFixed(2),
          status: 'PENDING_REVIEW'
        };
      } catch (err) {
        console.warn(`[Meta-Ads] Campaign create failed, returning stub: ${(err as Error).message}`);
      }
    }

    return {
      platform: 'meta',
      externalCampaignId: `meta-campaign-${input.postId}`,
      dailyBudget: +(input.budget / input.durationDays).toFixed(2),
      status: 'STUB'
    };
  }
}
