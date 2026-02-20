# DevChecklist Feasibility Status

Source checklist: `DevChecklist.jsx`

## Can be done immediately (engineering-only)
- Repo/CI/CD, schema, auth baseline, dashboard shell
- Upload flow (person video or photo + optional product photo), validation/transcoding workers, AI provider adapter
- Job status updates, retries, alerting, Sentry
- Scheduler, analytics sync framework, CSV export
- Stripe subscriptions/credits, usage enforcement
- Organizations, settings pages, responsive polish, security hardening, docs

## Requires external account approval/config first
- TikTok posting + ads scopes/business account
- Meta Graph + Ads app review and business verification
- X/Twitter media posting/ads elevated access
- YouTube upload OAuth consent + quota management
- LinkedIn marketing scopes/partner constraints (depends on account type)

## Practical delivery order
1. Foundation + MVP upload/generate/approve
2. Publish to 2–3 platforms first (Meta, TikTok, YouTube)
3. Add remaining publishers
4. Add paid boosts per platform
5. Full analytics + multi-brand polish

## Current scaffold delivered in this repo
- Monorepo root with workspaces and scripts
- `apps/web` Next.js dashboard shell
- `apps/api` Express API scaffold (`/health`, `/api/v1/jobs/create`)
- `apps/worker` BullMQ worker scaffold (`video_processing` queue)
- `packages/db` Prisma schema for core entities
- `supabase/migrations/20260220_init.sql` baseline schema migration
- `ROADMAP.md` phased rollout plan

## Remaining before first end-to-end MVP demo
- Install dependencies and run apps locally
- Wire Supabase client/auth in web and API
- Implement presigned upload + job create flow
- Connect worker queue enqueue/consume path
- Persist job state transitions in DB and surface in UI
