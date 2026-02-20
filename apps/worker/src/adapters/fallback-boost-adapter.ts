import type { AdsBoostAdapter, BoostInput, BoostResult } from './ads-boost-adapter';

export class FallbackBoostAdapter implements AdsBoostAdapter {
  name = 'fallback-boost';
  platform = 'fallback';

  isConfigured(): boolean {
    return false;
  }

  async createCampaign(input: BoostInput): Promise<BoostResult> {
    return {
      platform: input.platform || 'unknown',
      externalCampaignId: `fallback-campaign-${input.postId}`,
      dailyBudget: +(input.budget / input.durationDays).toFixed(2),
      status: 'STUB'
    };
  }
}
