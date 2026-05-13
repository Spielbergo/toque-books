-- ============================================================
-- NorthBooks: user_subscriptions table
-- Run this in the Supabase SQL Editor (or psql)
-- ============================================================

create table if not exists user_subscriptions (
  id                    uuid        default gen_random_uuid() primary key,
  user_id               uuid        references auth.users(id) on delete cascade not null unique,
  plan                  text        not null default 'free',   -- 'free' | 'pro'
  status                text        not null default 'active', -- 'active' | 'cancelled' | 'past_due'
  helcim_customer_code  text,
  helcim_subscription_id integer,
  current_period_end    timestamptz,
  updated_at            timestamptz default now(),
  created_at            timestamptz default now()
);

-- Row-level security: users can read their own row only
alter table user_subscriptions enable row level security;

create policy "users can read own subscription"
  on user_subscriptions
  for select
  using (auth.uid() = user_id);

-- Service role handles inserts/updates via API routes (bypasses RLS)
