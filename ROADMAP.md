# AI Ad Platform — MVP-First Roadmap

## Goal
Ship a Vercel + Supabase production MVP quickly, then add platform integrations and paid promotion in controlled phases.

## Architecture (recommended)
- **Web/API:** Next.js on Vercel (App Router + route handlers for lightweight API/webhooks)
- **Database/Auth/Storage:** Supabase (Postgres, Auth, Storage, Realtime)
- **Background jobs:** Worker service (BullMQ + Redis) for long-running tasks
- **Video processing:** FFmpeg in worker runtime (not serverless)
- **Observability:** Sentry + structured logs
- **Billing:** Stripe subscriptions + credit balance

## Phase 0 — Foundations (Week 1)
1. Monorepo scaffold (`apps/web`, `apps/api`, `apps/worker`, `packages/db`)
2. Supabase project + baseline schema migration
3. CI checks (lint/typecheck/build stubs)
4. Environment setup (`.env.example`) and secrets policy

**Exit criteria**
- Repo runs locally
- DB migrations apply cleanly
- Basic dashboard shell is deployable to Vercel

## Phase 1 — Core MVP (Weeks 2–4)
Includes checklist groups: 1.1–1.6, 2.1, 2.5, 2.6 (light), 6.7 (core only)

- Auth (email/password + role model)
- Upload flow via presigned URLs to Supabase Storage (person video or person photo + optional product photo)
- Jobs table + queue entry creation
- Basic status updates in dashboard
- Ad preview page with approve/regenerate actions

**Exit criteria**
- User can upload, create job, and track status end-to-end

## Phase 2 — Generation Pipeline (Weeks 4–6)
Includes: 2.2, 2.3, 2.4, 2.7

- Validation worker
- FFmpeg preprocessing variants
- AI provider adapter (D-ID/HeyGen interchangeable)
- Retry + alerting + Sentry errors

**Exit criteria**
- Reliable generated output with retry/failure visibility

## Phase 3 — Publishing Integrations (Weeks 6–9)
Includes: 3.1–3.8

- OAuth connections per platform
- Token encryption + refresh routines
- Publish now/scheduled jobs
- Persist post IDs + URLs

**Exit criteria**
- Publish to at least 3 platforms from one UI

## Phase 4 — Paid Promotion (Weeks 8–10)
Includes: 4.1–4.6, 4.5 dependency

- Boost UI + campaign creation
- Ad spend sync every 6h
- Stripe credit balance enforcement

**Exit criteria**
- Create and track boosted campaigns with spend protection

## Phase 5 — Analytics + Billing + Multi-Brand (Weeks 10–12)
Includes: 5.1–5.4, 6.1–6.6, 6.8

- Unified analytics dashboards + CSV export
- Subscription plans + quota controls
- Organizations and brand switcher
- Documentation + handover artifacts

**Exit criteria**
- Production-ready SaaS operations and reporting

## Risk/Dependency Notes
- Platform app approvals can delay timelines (TikTok/Meta/X/LinkedIn/YouTube).
- X Ads and some advanced permissions may require elevated access.
- Long-running work must stay off Vercel functions (worker service required).

## Suggested MVP Cutline (first launch)
- Upload (person video or photo) + optional product photo + generate + approve
- Publish to TikTok + Meta + YouTube only
- Basic analytics (views/spend/reach)
- Stripe Starter/Pro plans + quota checks
