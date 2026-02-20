1

1.1
Repo & CI/CD setup
GitHub monorepo, GitHub Actions pipelines, ESLint + Prettier + Husky pre-commit hooks. Separate apps: web (Next.js), api (Node/Express), worker (BullMQ).

▲
1.2
Database schema design
Tables: users, organizations, projects, jobs, published_posts, platform_tokens, ad_campaigns, analytics. Prisma ORM. Write and run all migrations.

▲
1.3
Auth system
Email/password signup/login. Google OAuth. Session via NextAuth.js or Clerk. Roles: admin, customer. JWT for API auth.

▲
1.4
S3/R2 file storage setup
Presigned URL upload flow. Buckets: raw_uploads, source_images, product_images, processed_videos, generated_ads. IAM policy: least privilege.

▲
1.5
BullMQ + Redis job queues
Queues: video_processing, ai_generation, social_publishing, ads_boost. Dead-letter queue. Retry logic (3x). Bull Board for monitoring.

▲
1.6
Base dashboard shell
Authenticated layout, sidebar nav, empty-state pages for: Jobs, Published, Analytics, Platforms, Billing, Settings. Mobile responsive.

▲
2

2.1
Media upload UI
Drag-and-drop + file picker. Accept MP4/MOV ≤500MB for person input OR JPG/PNG/WEBP ≤20MB for person photo input. Accept optional product photo JPG/PNG/WEBP ≤20MB. Presigned URL upload direct to S3/R2. Show upload progress bar. Store record in jobs table.

▲
2.2
Media validation worker
On upload complete: if video, check duration (5–120s), resolution (≥720p), codec; if photo, check format, file size, min dimensions, and basic face-detect readiness. For product photo, check format, file size, and min dimensions. Reject with user-friendly error message if invalid.

▲
2.3
FFmpeg preprocessing worker
Normalize audio, transcode to H.264 MP4, extract thumbnail frame, generate 3 aspect ratio versions: 9:16, 16:9, 1:1.

▲
2.4
AI Avatar API integration
Integrate D-ID or HeyGen API. Abstract behind internal adapter interface so provider is swappable. Accept person source as video or photo, plus optional product photo context. POST source media → poll for completion → download result → store to generated_ads bucket.

▲
2.5
Ad preview UI
Side-by-side: original media (person video or photo, and product photo if provided) vs generated ad. Actions: Approve, Regenerate, Edit caption/title. Update job status accordingly.

▲
2.6
Job status real-time updates
SSE or WebSocket for live status: queued → processing → awaiting_approval → approved → published. Show progress indicator in dashboard.

▲
2.7
Error handling & retries
Failed jobs notify user via email + dashboard alert banner. Auto-retry up to 3x. Manual retry option in UI. Log all errors to Sentry.

▲
3
3.1
Platform OAuth2 connect flow
Wizard UI for connecting each platform. OAuth2 authorization flow. Store encrypted access + refresh tokens in platform_tokens table. Token auto-refresh logic.

▲
3.2
TikTok publishing
Content Posting API v2. POST /v2/post/publish/video/init → upload → publish. Requires Business Account. Scopes: video.upload, video.publish.

▲
3.3
Facebook & Instagram publishing
Meta Graph API v18+. Facebook: POST /{page-id}/videos. Instagram Reels: POST /{ig-user-id}/media then /media_publish. Page access token required.

▲
3.4
Twitter/X publishing
Twitter API v2. Chunked media upload: INIT → APPEND → FINALIZE → STATUS poll. Then POST /2/tweets with media_id. OAuth 1.0a or OAuth 2.0 PKCE.

▲
3.5
YouTube Shorts publishing
YouTube Data API v3. videos.insert with 9:16 aspect ratio + #Shorts in description. OAuth2 scope: youtube.upload. Check upload quota limits.

▲
3.6
LinkedIn publishing
LinkedIn Marketing API. Register upload → upload binary → POST /ugcPosts with VIDEO asset. Scope: w_member_social.

▲
3.7
Publishing scheduler UI
Select platforms, set publish time (now or scheduled). Store schedule in DB. BullMQ delayed job for scheduled posts. Show scheduled queue in dashboard.

▲
3.8
Post result tracking
On successful publish: store post_id and platform URL in published_posts table. Show links in dashboard. Handle platform API errors gracefully.

▲
4
4.1
Meta Ads API integration
Create AdCampaign → AdSet → Ad using published post as creative. Objectives: REACH or VIDEO_VIEWS. Daily budget + duration inputs. Store campaign_id.

▲
4.2
TikTok Ads API — Spark Ads
Spark Ads mode: boost existing organic TikTok post. Create campaign → ad group → ad with post video_id as creative. Set budget + duration.

▲
4.3
Twitter Ads API
Create Promoted Tweet from existing organic tweet ID. Set campaign budget, daily budget, duration. Store campaign data.

▲
4.4
Boost UI panel
After publishing, show 'Boost This Ad' panel. Fields: budget ($), duration (days), objective. Show estimated reach (from platform API). Confirm button.

▲
4.5
Stripe credit balance system
Customers add credit balance via Stripe. Ad spend deducted from balance. Low balance alert email at <$10. Prevent campaign creation if insufficient balance.

▲
4.6
Ad campaigns analytics sync
BullMQ repeatable job every 6h: pull spend, impressions, clicks from each ads API. Sync to ad_campaigns table.

▲
5
5.1
Per-platform analytics sync
Pull views, likes, shares, comments, reach from each platform's analytics API. Schedule: every 6h via BullMQ repeatable job. Store in analytics table.

▲
5.2
Analytics dashboard UI
Summary cards: total reach, total spend, total posts, best performer. Line chart (views over time). Bar chart (platform comparison). Donut (spend breakdown). Use Recharts.

▲
5.3
Per-post analytics detail view
Click any post to see full performance breakdown: views, likes, shares, comments, clicks, spend, estimated CPM. Platform-by-platform tabs.

▲
5.4
CSV export
Export all campaign and performance data as CSV. Include: post title, platform, publish date, views, spend, clicks, reach.

▲
6
6.1
Stripe subscription billing
Plans: Free (3 ads), Starter ($X/mo — 20 ads), Pro ($XX/mo — unlimited). Stripe Checkout + Billing Portal. Webhook handler for subscription events (created, updated, cancelled).

▲
6.2
Usage limit enforcement
Check ad quota server-side before accepting new job. Return 402 if limit reached. Show upgrade prompt in UI.

▲
6.3
Organizations & multi-brand
One account can manage multiple brand profiles. Each brand has own platform tokens, jobs, posts. Brand switcher in dashboard header.

▲
6.4
Onboarding wizard
Step-by-step connect social accounts flow. Clear OAuth permission explanations per platform. Skip option. Progress indicator. Trigger on first login.

▲
6.5
Settings pages
Account (name, email, password, delete account). Billing (plan, invoices, portal). Connected Platforms (connect/disconnect per platform). Notifications.

▲
6.6
Mobile responsive polish
Ensure full dashboard usable on tablet and phone. Test on iOS Safari and Android Chrome. Fix any layout breaks.

▲
6.7
Security hardening
Zod validation all routes. Rate limiting (upstash or express-rate-limit). Helmet.js. CORS locked. Verify platform webhook signatures. Audit all userId WHERE clauses.

▲
6.8
Handover & documentation
README: local setup, env vars, DB migrations, deployment guide. Postman collection or OpenAPI 3.0 spec for all endpoints. Loom walkthrough video optional.