# AI Ad Platform

A production-ready, full-stack AI advertising platform monorepo. Generates social media ad content with AI, publishes to multiple platforms, tracks analytics, and manages paid ad campaigns — all from a single dashboard.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Running the App](#running-the-app)
- [Background Workers](#background-workers)
- [Key Features](#key-features)
- [API Routes](#api-routes)
- [Deployment](#deployment)

---

## Architecture Overview

```
Tester/
├── apps/
│   └── web/                  # Next.js 15 application (App Router)
│       ├── app/
│       │   ├── api/v1/       # REST API routes
│       │   └── page.tsx      # Main SPA dashboard
│       ├── lib/              # Server-side business logic
│       └── workers/          # BullMQ background job workers
├── supabase/
│   └── migrations/           # Postgres schema migrations
└── packages/                 # Shared types / utilities (future)
```

The dashboard is a single-page React app (inside the Next.js App Router). All data operations go through `/api/v1/` REST endpoints that run as Next.js Route Handlers.

Background jobs (AI generation, video processing, social publishing) run as long-lived BullMQ workers powered by Redis.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.1 (App Router, React 19) |
| Database | Supabase (PostgreSQL + Auth) |
| Job Queue | BullMQ + Redis |
| Payments | Stripe (subscriptions + ad credits) |
| Email | Resend |
| AI | OpenAI GPT-4o |
| Social APIs | Facebook Graph, Twitter/X v2, Instagram, LinkedIn, TikTok |
| Error Tracking | Sentry |
| Charts | Recharts |
| Styling | Custom CSS (globals.css) |

---

## Prerequisites

- Node.js 20+
- pnpm 9+ (`npm i -g pnpm`)
- Docker Desktop (for local Redis + Supabase)
- Stripe CLI (for webhook forwarding in dev)

---

## Local Development Setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/ai-ad-platform.git
cd ai-ad-platform
pnpm install
```

### 2. Start infrastructure

```bash
# Start local Supabase (Postgres + Auth + Studio)
npx supabase start

# Start Redis (Docker)
docker run -d -p 6379:6379 redis:7-alpine
```

### 3. Run database migrations

```bash
npx supabase db reset
# or apply incrementally:
npx supabase migration up
```

### 4. Configure environment variables

Copy the template and fill in values (see [Environment Variables](#environment-variables)):

```bash
cp apps/web/.env.example apps/web/.env.local
```

### 5. Start the dev server

```bash
pnpm --filter web dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### 6. Forward Stripe webhooks (optional, for billing flows)

```bash
stripe listen --forward-to http://localhost:3000/api/v1/webhooks/stripe
```

---

## Environment Variables

Create `apps/web/.env.local` with the following:

```env
# ── Supabase ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# ── Stripe ───────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...         # Monthly Pro plan Price ID
STRIPE_PRICE_AGENCY=price_...      # Agency plan Price ID

# ── Redis (BullMQ) ───────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Resend (email) ───────────────────────────────────────────────────────────
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# ── OpenAI ───────────────────────────────────────────────────────────────────
OPENAI_API_KEY=sk-...

# ── App ──────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000

# ── Social Platform OAuth ────────────────────────────────────────────────────
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=

# ── Sentry ───────────────────────────────────────────────────────────────────
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

---

## Database Migrations

All migrations live in `supabase/migrations/`. Apply them in order:

| File | Description |
|---|---|
| `20240101_initial_schema.sql` | Core tables: `jobs`, `published_posts`, `ad_campaigns`, `platform_tokens` |
| `20240102_subscriptions.sql` | `user_subscriptions` table + quota tracking |
| `20240103_analytics.sql` | `post_analytics` time-series table |
| `20260223_credit_balance.sql` | Adds `credit_balance` column to `user_subscriptions` |

To apply all migrations against a local Supabase instance:

```bash
npx supabase db reset
```

To apply only new migrations:

```bash
npx supabase migration up
```

---

## Running the App

### Development

```bash
pnpm --filter web dev
```

### Production build

```bash
pnpm --filter web build
pnpm --filter web start
```

### Type check

```bash
cd apps/web && npx tsc --noEmit
```

---

## Background Workers

Workers consume BullMQ jobs from Redis. They must run alongside the Next.js server.

```bash
# From repo root
pnpm --filter web workers
# or directly
cd apps/web && node workers/index.js
```

### Job pipeline

```
media_validation → video_processing → ai_generation → social_publishing
```

- **media_validation** — validates uploaded image/video dimensions and format
- **video_processing** — transcodes video to platform-spec sizes
- **ai_generation** — calls OpenAI to generate ad copy and overlays
- **social_publishing** — posts to connected social platforms via OAuth tokens

Job failures trigger email alerts via Resend.

---

## Key Features

### Dashboard sections

| Section | Description |
|---|---|
| **Jobs** | Create and monitor AI ad generation jobs |
| **Published** | View published posts with per-post analytics detail (views, reach, CPM, etc.) |
| **Analytics** | Aggregated analytics across all platforms with time-series charts |
| **Campaigns** | List active and past ad campaigns |
| **Billing** | Manage subscription plan + ad credit balance |
| **Platforms** | Connect / disconnect OAuth social accounts |
| **Settings** | Account info, notification preferences, danger zone |

### Ad Credit System

Users pre-purchase ad credits via Stripe. Credits are deducted when boosting a post. If the balance would go below zero, the boost is rejected with a 402 response. A low-balance warning email is sent when the balance drops below $10.

Top up from the **Billing → Ad Credit Balance** card.

### Per-post Analytics

Click **View Analytics** on any published post to see:
- Platform-segmented KPI grid (views, reach, likes, shares, comments, clicks, estimated CPM)
- Time-series line chart (views + reach over time)
- CSV export of all analytics + campaigns

### Onboarding Wizard

New users who haven't connected any social platforms are guided through a 3-step wizard:
1. Welcome
2. Connect platforms (OAuth links)
3. Done — redirects to Jobs

Completion is stored in `localStorage` keyed to the user ID.

---

## API Routes

All routes are under `/api/v1/` and require a Supabase session cookie (or `Authorization: Bearer <token>` header).

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/jobs` | List all jobs for the authenticated user |
| `POST` | `/api/v1/jobs` | Create a new AI ad job |
| `GET` | `/api/v1/posts` | List published posts |
| `POST` | `/api/v1/posts/:id/boost` | Boost a published post (deducts credits) |
| `GET` | `/api/v1/analytics` | Aggregated analytics |
| `GET` | `/api/v1/analytics/posts/:id` | Per-post analytics time series |
| `GET` | `/api/v1/analytics/export` | Download analytics as CSV |
| `GET` | `/api/v1/billing/subscription` | Get current subscription + quota |
| `GET/POST` | `/api/v1/billing/credits` | Get credit balance / top up via Stripe |
| `GET` | `/api/v1/billing/portal` | Redirect to Stripe Customer Portal |
| `GET` | `/api/v1/billing/checkout` | Start Stripe checkout for plan upgrade |
| `POST` | `/api/v1/webhooks/stripe` | Stripe webhook (subscriptions + credit purchases) |
| `GET` | `/api/v1/platforms` | List connected platforms |
| `GET` | `/api/v1/oauth/:platform/start` | Start OAuth flow |
| `GET` | `/api/v1/oauth/:platform/callback` | OAuth callback |

---

## Deployment

### Vercel (recommended for Next.js)

1. Push to GitHub/GitLab.
2. Import the repo in [vercel.com](https://vercel.com) → set **Root Directory** to `apps/web`.
3. Add all environment variables from the table above.
4. Set up a Redis provider (Upstash Redis recommended — copy `REDIS_URL`).
5. Set up Stripe webhook pointing to `https://your-domain.com/api/v1/webhooks/stripe`.

### Workers on Render / Railway

Deploy the worker process separately as a Background Worker service pointing to `apps/web/workers/index.js`. Set the same environment variables.

### Supabase (production)

1. Create a project at [supabase.com](https://supabase.com).
2. Run all migrations via the Supabase SQL editor or `supabase db push`.
3. Copy `Project URL` and both keys to your environment variables.
4. Enable the Auth providers you need (Email, GitHub, Google, etc.) in the Supabase dashboard.


## Quick start
1. Copy `.env.example` to `.env` and fill values.
2. Start Redis locally: `docker compose up -d redis`
3. Install deps: `npm install`
4. Run web app: `npm run dev:web`
5. Run worker: `npm run dev:worker`

## What is implemented now
- Job creation flow with person media (video/photo) + optional product photo metadata
- Upload ticket endpoint for Supabase signed uploads (with local fallback mode)
- Jobs API (create/list/approve/regenerate)
- Publishing API (`/posts/publish`) and boost API (`/posts/:id/boost`)
- Analytics summary API and billing/platform status stubs
- Worker pipeline queues:
	- `video_processing`
	- `ai_generation`
	- `social_publishing`
	- `ads_boost`
	- `analytics_sync`
- Swappable AI adapter interface with D-ID and HeyGen adapter stubs

## API routes (web app)
- `POST /api/v1/uploads/request`
- `POST /api/v1/jobs/create`
- `GET /api/v1/jobs`
- `POST /api/v1/jobs/:id/approve`
- `POST /api/v1/jobs/:id/regenerate`
- `POST /api/v1/posts/publish`
- `POST /api/v1/posts/:id/boost`
- `GET /api/v1/analytics/summary`
- `GET /api/v1/platforms`
- `GET /api/v1/billing/subscription`

## Supabase requirements
Create storage buckets:
- `raw_uploads`
- `source_images`
- `product_images`
- `generated_ads`

Apply SQL migration in `supabase/migrations/20260220_init.sql`.

## Notes
- Keep long-running tasks in `apps/worker` (not Vercel serverless).
- Provider-specific publishing/ads calls are intentionally adapter stubs until credentials + app approvals are available.
- Analytics sync now queues background jobs; worker writes analytics rows to Supabase when service-role env vars are set.
- Worker auto-registers a repeatable analytics sweep job (default every 6 hours) controlled by `ANALYTICS_SYNC_EVERY_MS`.
- Platform analytics providers are adapter stubs (TikTok, Meta, X, YouTube, LinkedIn) and are ready for real API integration.
- See `ROADMAP.md` for phased delivery.
