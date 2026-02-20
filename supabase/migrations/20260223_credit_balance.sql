-- Add credit_balance to user_subscriptions for ad-spend wallet
alter table user_subscriptions
  add column if not exists credit_balance numeric(10,2) not null default 0.00;
