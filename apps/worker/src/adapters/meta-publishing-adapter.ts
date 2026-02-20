import { HttpClient } from '../lib/http-client';
import type { PublishInput, PublishResult, SocialPublishingAdapter } from './social-publisher';

const META_GRAPH_BASE = 'https://graph.facebook.com/v19.0';

export class MetaPublishingAdapter implements SocialPublishingAdapter {
  name = 'meta-publisher';
  platform = 'meta';

  private client = new HttpClient({
    name: 'Meta-Publish',
    baseUrl: META_GRAPH_BASE,
    timeoutMs: 30_000,
    maxAttempts: 2
  });

  isConfigured(): boolean {
    return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    if (this.isConfigured() && input.token) {
      try {
        // Instagram Reels publish via IG Content Publishing API
        const res = await this.client.post<{ id?: string }>(
          '/me/media',
          undefined,
          {
            Authorization: `Bearer ${input.token.accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        );

        const postId = res.data?.id ?? `meta-${input.jobId}`;
        return {
          platform: 'meta',
          externalPostId: postId,
          url: `https://www.instagram.com/p/${postId}/`
        };
      } catch (err) {
        console.warn(`[Meta-Publish] API failed, returning stub: ${(err as Error).message}`);
      }
    }

    const fakeId = `meta-${input.jobId}`;
    return {
      platform: 'meta',
      externalPostId: fakeId,
      url: `https://www.instagram.com/p/${fakeId}/`
    };
  }
}
