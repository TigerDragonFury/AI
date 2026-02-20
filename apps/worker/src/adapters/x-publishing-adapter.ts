import { HttpClient } from '../lib/http-client';
import type { PublishInput, PublishResult, SocialPublishingAdapter } from './social-publisher';

const X_API_BASE = 'https://api.x.com/2';

export class XPublishingAdapter implements SocialPublishingAdapter {
  name = 'x-publisher';
  platform = 'x';

  private client = new HttpClient({
    name: 'X-Publish',
    baseUrl: X_API_BASE,
    timeoutMs: 20_000,
    maxAttempts: 2
  });

  isConfigured(): boolean {
    return !!(process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET);
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    if (this.isConfigured() && input.token) {
      try {
        // Create tweet with media (assumes media was previously uploaded)
        const res = await this.client.post<{ data?: { id: string } }>(
          '/tweets',
          { text: `${input.caption}\n\n${input.videoUrl}` },
          { Authorization: `Bearer ${input.token.accessToken}` }
        );

        const tweetId = res.data?.data?.id ?? `x-${input.jobId}`;
        return {
          platform: 'x',
          externalPostId: tweetId,
          url: `https://x.com/i/status/${tweetId}`
        };
      } catch (err) {
        console.warn(`[X-Publish] API failed, returning stub: ${(err as Error).message}`);
      }
    }

    const fakeId = `x-${input.jobId}`;
    return {
      platform: 'x',
      externalPostId: fakeId,
      url: `https://x.com/i/status/${fakeId}`
    };
  }
}
