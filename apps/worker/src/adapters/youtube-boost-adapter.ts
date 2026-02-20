import { HttpClient } from '../lib/http-client';
import type { AdsBoostAdapter, BoostInput, BoostResult } from './ads-boost-adapter';

const YT_ADS_BASE = 'https://googleads.googleapis.com/v16';

export class YouTubeBoostAdapter implements AdsBoostAdapter {
  name = 'youtube-boost';
  platform = 'youtube';

  private client = new HttpClient({
    name: 'YouTube-Ads',
    baseUrl: YT_ADS_BASE,
    timeoutMs: 15_000,
    maxAttempts: 2
  });

  isConfigured(): boolean {
    return !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);
  }

  async createCampaign(input: BoostInput): Promise<BoostResult> {
    if (this.isConfigured() && input.token) {
      try {
        const res = await this.client.post<{
          results?: Array<{ resourceName: string }>;
        }>(
          '/customers/<customer_id>/campaigns:mutate',
          {
            operations: [
              {
                create: {
                  name: `Boost ${input.postId}`,
                  advertisingChannelType: 'VIDEO',
                  status: 'PAUSED',
                  campaignBudget: `customers/<customer_id>/campaignBudgets/placeholder`
                }
              }
            ]
          },
          { Authorization: `Bearer ${input.token.accessToken}` }
        );

        const resourceName = res.data?.results?.[0]?.resourceName ?? `yt-campaign-${input.postId}`;
        return {
          platform: 'youtube',
          externalCampaignId: resourceName,
          dailyBudget: +(input.budget / input.durationDays).toFixed(2),
          status: 'PENDING_REVIEW'
        };
      } catch (err) {
        console.warn(`[YouTube-Ads] Campaign create failed, returning stub: ${(err as Error).message}`);
      }
    }

    return {
      platform: 'youtube',
      externalCampaignId: `yt-campaign-${input.postId}`,
      dailyBudget: +(input.budget / input.durationDays).toFixed(2),
      status: 'STUB'
    };
  }
}
