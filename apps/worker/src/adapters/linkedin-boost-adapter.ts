import { HttpClient } from '../lib/http-client';
import type { AdsBoostAdapter, BoostInput, BoostResult } from './ads-boost-adapter';

const LI_ADS_BASE = 'https://api.linkedin.com/v2';

export class LinkedInBoostAdapter implements AdsBoostAdapter {
  name = 'linkedin-boost';
  platform = 'linkedin';

  private client = new HttpClient({
    name: 'LinkedIn-Ads',
    baseUrl: LI_ADS_BASE,
    timeoutMs: 15_000,
    maxAttempts: 2
  });

  isConfigured(): boolean {
    return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
  }

  async createCampaign(input: BoostInput): Promise<BoostResult> {
    if (this.isConfigured() && input.token) {
      try {
        const res = await this.client.post<{ id?: string }>(
          '/adCampaignsV2',
          {
            name: `Boost ${input.postId}`,
            type: 'SPONSORED_UPDATES',
            objectiveType: input.objective === 'REACH' ? 'BRAND_AWARENESS' : 'VIDEO_VIEWS',
            status: 'DRAFT',
            dailyBudget: {
              amount: String(Math.round(input.budget / input.durationDays)),
              currencyCode: 'USD'
            }
          },
          { Authorization: `Bearer ${input.token.accessToken}` }
        );

        return {
          platform: 'linkedin',
          externalCampaignId: res.data?.id ?? `li-campaign-${input.postId}`,
          dailyBudget: +(input.budget / input.durationDays).toFixed(2),
          status: 'PENDING_REVIEW'
        };
      } catch (err) {
        console.warn(`[LinkedIn-Ads] Campaign create failed, returning stub: ${(err as Error).message}`);
      }
    }

    return {
      platform: 'linkedin',
      externalCampaignId: `li-campaign-${input.postId}`,
      dailyBudget: +(input.budget / input.durationDays).toFixed(2),
      status: 'STUB'
    };
  }
}
