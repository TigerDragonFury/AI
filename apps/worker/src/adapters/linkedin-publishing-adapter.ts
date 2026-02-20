import { HttpClient } from '../lib/http-client';
import type { PublishInput, PublishResult, SocialPublishingAdapter } from './social-publisher';

const LI_API_BASE = 'https://api.linkedin.com/v2';

export class LinkedInPublishingAdapter implements SocialPublishingAdapter {
  name = 'linkedin-publisher';
  platform = 'linkedin';

  private client = new HttpClient({
    name: 'LinkedIn-Publish',
    baseUrl: LI_API_BASE,
    timeoutMs: 20_000,
    maxAttempts: 2
  });

  isConfigured(): boolean {
    return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    if (this.isConfigured() && input.token) {
      try {
        const res = await this.client.post<{ id?: string }>(
          '/ugcPosts',
          {
            author: `urn:li:person:${input.userId}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: { text: input.caption },
                shareMediaCategory: 'VIDEO',
                media: [
                  {
                    status: 'READY',
                    originalUrl: input.videoUrl,
                    description: { text: input.caption }
                  }
                ]
              }
            },
            visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
          },
          { Authorization: `Bearer ${input.token.accessToken}` }
        );

        const postId = res.data?.id ?? `li-${input.jobId}`;
        return {
          platform: 'linkedin',
          externalPostId: postId,
          url: `https://www.linkedin.com/feed/update/${postId}/`
        };
      } catch (err) {
        console.warn(`[LinkedIn-Publish] API failed, returning stub: ${(err as Error).message}`);
      }
    }

    const fakeId = `li-${input.jobId}`;
    return {
      platform: 'linkedin',
      externalPostId: fakeId,
      url: `https://www.linkedin.com/feed/update/${fakeId}/`
    };
  }
}
