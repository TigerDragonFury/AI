create type job_status as enum ('queued', 'processing', 'awaiting_approval', 'approved', 'published', 'failed');

create table if not exists users (
  id text primary key,
  email text unique not null,
  role text not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_subscriptions (
  user_id text primary key references users(id),
  plan text not null default 'free',
  status text not null default 'trial',
  credits double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organizations (
  id text primary key,
  owner_id text not null references users(id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id text primary key,
  organization_id text not null references organizations(id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jobs (
  id text primary key,
  user_id text references users(id),
  project_id text references projects(id),
  status job_status not null default 'queued',
  person_source_type text not null,
  person_source_name text not null,
  person_source_url text,
  product_photo_name text,
  product_photo_url text,
  product_description text,
  tone text,
  target_platforms text[] not null default '{}',
  generated_video_url text,
  caption text,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists published_posts (
  id text primary key,
  job_id text not null references jobs(id),
  platform text not null,
  platform_post_id text not null,
  url text,
  created_at timestamptz not null default now()
);

create table if not exists published_post_groups (
  id text primary key,
  user_id text not null references users(id),
  job_id text not null references jobs(id),
  platforms text[] not null default '{}',
  status text not null default 'published',
  schedule_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_tokens (
  id text primary key,
  user_id text not null references users(id),
  platform text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_platform_tokens_user_platform on platform_tokens(user_id, platform);

create table if not exists ad_campaigns (
  id text primary key,
  user_id text not null references users(id),
  published_post_id text not null references published_post_groups(id),
  platform text not null,
  campaign_id text not null,
  objective text,
  duration_days integer not null default 0,
  budget double precision not null default 0,
  spend double precision not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists analytics (
  id text primary key,
  user_id text not null references users(id),
  published_post_id text not null references published_post_groups(id),
  platform text not null,
  views integer not null default 0,
  likes integer not null default 0,
  shares integer not null default 0,
  comments integer not null default 0,
  clicks integer not null default 0,
  reach integer not null default 0,
  captured_at timestamptz not null default now()
);
create index if not exists idx_analytics_platform_captured_at on analytics(platform, captured_at);
create index if not exists idx_published_post_groups_user on published_post_groups(user_id, created_at);
create index if not exists idx_ad_campaigns_user on ad_campaigns(user_id, created_at);
create index if not exists idx_analytics_user_post on analytics(user_id, published_post_id, captured_at);

alter table users enable row level security;
alter table jobs enable row level security;
alter table platform_tokens enable row level security;
alter table user_subscriptions enable row level security;
alter table published_post_groups enable row level security;
alter table ad_campaigns enable row level security;
alter table analytics enable row level security;

drop policy if exists users_select_own on users;
create policy users_select_own on users
  for select using (auth.uid()::text = id);

drop policy if exists users_update_own on users;
create policy users_update_own on users
  for update using (auth.uid()::text = id)
  with check (auth.uid()::text = id);

drop policy if exists jobs_select_own on jobs;
create policy jobs_select_own on jobs
  for select using (auth.uid()::text = user_id);

drop policy if exists jobs_insert_own on jobs;
create policy jobs_insert_own on jobs
  for insert with check (auth.uid()::text = user_id);

drop policy if exists jobs_update_own on jobs;
create policy jobs_update_own on jobs
  for update using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists platform_tokens_select_own on platform_tokens;
create policy platform_tokens_select_own on platform_tokens
  for select using (auth.uid()::text = user_id);

drop policy if exists platform_tokens_insert_own on platform_tokens;
create policy platform_tokens_insert_own on platform_tokens
  for insert with check (auth.uid()::text = user_id);

drop policy if exists platform_tokens_update_own on platform_tokens;
create policy platform_tokens_update_own on platform_tokens
  for update using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists platform_tokens_delete_own on platform_tokens;
create policy platform_tokens_delete_own on platform_tokens
  for delete using (auth.uid()::text = user_id);

drop policy if exists subscriptions_select_own on user_subscriptions;
create policy subscriptions_select_own on user_subscriptions
  for select using (auth.uid()::text = user_id);

drop policy if exists subscriptions_insert_own on user_subscriptions;
create policy subscriptions_insert_own on user_subscriptions
  for insert with check (auth.uid()::text = user_id);

drop policy if exists subscriptions_update_own on user_subscriptions;
create policy subscriptions_update_own on user_subscriptions
  for update using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists post_groups_select_own on published_post_groups;
create policy post_groups_select_own on published_post_groups
  for select using (auth.uid()::text = user_id);

drop policy if exists post_groups_insert_own on published_post_groups;
create policy post_groups_insert_own on published_post_groups
  for insert with check (auth.uid()::text = user_id);

drop policy if exists post_groups_update_own on published_post_groups;
create policy post_groups_update_own on published_post_groups
  for update using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists campaigns_select_own on ad_campaigns;
create policy campaigns_select_own on ad_campaigns
  for select using (auth.uid()::text = user_id);

drop policy if exists campaigns_insert_own on ad_campaigns;
create policy campaigns_insert_own on ad_campaigns
  for insert with check (auth.uid()::text = user_id);

drop policy if exists campaigns_update_own on ad_campaigns;
create policy campaigns_update_own on ad_campaigns
  for update using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists analytics_select_own on analytics;
create policy analytics_select_own on analytics
  for select using (auth.uid()::text = user_id);

drop policy if exists analytics_insert_own on analytics;
create policy analytics_insert_own on analytics
  for insert with check (auth.uid()::text = user_id);
