-- Add Stripe billing columns to user_subscriptions
alter table user_subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create index if not exists idx_user_subscriptions_stripe_customer
  on user_subscriptions(stripe_customer_id)
  where stripe_customer_id is not null;

-- Add generated_video_url + caption fields (may already exist in some envs)
alter table jobs
  add column if not exists generated_video_url text,
  add column if not exists caption text,
  add column if not exists title text;
