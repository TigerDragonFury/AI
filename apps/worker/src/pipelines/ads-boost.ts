import { normalizePlatform } from '../adapters/analytics-provider';
import { getBoostAdapterForPlatform } from '../adapters/boost-adapter-factory';
import { getPlatformToken } from '../lib/platform-tokens';

export type BoostPayload = {
  postId: string;
  platform: string;
  budget: number;
  durationDays: number;
  objective: 'REACH' | 'VIDEO_VIEWS';
  userId?: string;
};

export async function runAdsBoost(payload: BoostPayload) {
  const normalized = normalizePlatform(payload.platform);
  const adapter = getBoostAdapterForPlatform(payload.platform);
  const token = payload.userId
    ? await getPlatformToken(payload.userId, normalized)
    : null;

  const result = await adapter.createCampaign({
    userId: payload.userId ?? '',
    postId: payload.postId,
    platform: payload.platform,
    budget: payload.budget,
    durationDays: payload.durationDays,
    objective: payload.objective,
    token
  });

  return result;
}
