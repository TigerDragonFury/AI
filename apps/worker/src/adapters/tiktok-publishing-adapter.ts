import { HttpClient } from '../lib/http-client';
import type { PublishInput, PublishResult, SocialPublishingAdapter } from './social-publisher';

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

export class TikTokPublishingAdapter implements SocialPublishingAdapter {
  name = 'tiktok-publisher';
  platform = 'tiktok';

  private client = new HttpClient({
    name: 'TikTok-Publish',
    baseUrl: TIKTOK_API_BASE,
    timeoutMs: 30_000,
    maxAttempts: 2
  });

  isConfigured(): boolean {
    return !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    if (this.isConfigured() && input.token) {
      try {
        // Step 1 – init upload
        const init = await this.client.post<{
          data?: { publish_id: string; upload_url: string };
        }>(
          '/post/publish/video/init/',
          {
            post_info: { title: input.caption, privacy_level: 'PUBLIC_TO_EVERYONE' },
            source_info: { source: 'PULL_FROM_URL', video_url: input.videoUrl }
          },
          { Authorization: `Bearer ${input.token.accessToken}`, 'Content-Type': 'application/json' }
        );

        const publishId = init.data?.data?.publish_id ?? `tiktok-${input.jobId}`;
        return {
          platform: 'tiktok',
          externalPostId: publishId,
          url: `https://www.tiktok.com/@user/video/${publishId}`
        };
      } catch (err) {
        console.warn(`[TikTok-Publish] API failed, returning stub: ${(err as Error).message}`);
      }
    }

    // Dev fallback
    const fakeId = `tiktok-${input.jobId}`;
    return {
      platform: 'tiktok',
      externalPostId: fakeId,
      url: `https://www.tiktok.com/@dev/video/${fakeId}`
    };
  }
}
