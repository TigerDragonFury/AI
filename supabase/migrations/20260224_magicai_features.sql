-- MagicAI-inspired feature tables
-- Run via: npx supabase migration up

-- ── Teams ──────────────────────────────────────────────────────────────────
create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  slug        text unique not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','admin','member')),
  invited_by uuid references auth.users(id),
  joined_at  timestamptz not null default now(),
  unique(team_id, user_id)
);

-- ── AI Settings (admin-configurable engine keys) ────────────────────────────
create table if not exists ai_settings (
  id             uuid primary key default gen_random_uuid(),
  key            text unique not null,   -- e.g. 'openai_api_key'
  value          text,
  is_secret      boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- ── Prompt Templates ─────────────────────────────────────────────────────────
create table if not exists prompt_templates (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade, -- null = system/global
  team_id      uuid references teams(id) on delete set null,
  title        text not null,
  description  text,
  prompt       text not null,
  category     text not null default 'general',
  tags         text[] not null default '{}',
  is_public    boolean not null default false,
  use_count    int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── AI Chats ─────────────────────────────────────────────────────────────────
create table if not exists ai_chats (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  team_id      uuid references teams(id) on delete set null,
  title        text not null default 'New Chat',
  engine       text not null default 'openai',
  model        text not null default 'gpt-4o-mini',
  system_prompt text,
  persona_id   uuid,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists ai_chat_messages (
  id           uuid primary key default gen_random_uuid(),
  chat_id      uuid not null references ai_chats(id) on delete cascade,
  role         text not null check (role in ('system','user','assistant')),
  content      text not null,
  tokens_used  int,
  created_at   timestamptz not null default now()
);

-- ── AI Chat Personas (assistant identities) ───────────────────────────────────
create table if not exists ai_personas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  name         text not null,
  description  text,
  avatar_url   text,
  system_prompt text not null,
  default_model text not null default 'gpt-4o-mini',
  default_engine text not null default 'openai',
  is_public    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ── Generated Images ──────────────────────────────────────────────────────────
create table if not exists generated_images (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  team_id       uuid references teams(id) on delete set null,
  engine        text not null,
  model         text not null,
  prompt        text not null,
  negative_prompt text,
  image_url     text not null,
  size          text,
  quality       text,
  style         text,
  seed          bigint,
  is_favourite  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ── Generated TTS ─────────────────────────────────────────────────────────────
create table if not exists generated_tts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  engine        text not null,
  model         text,
  voice_id      text,
  text_input    text not null,
  audio_url     text not null,
  duration_sec  numeric(8,2),
  file_size     int,
  created_at    timestamptz not null default now()
);

-- ── Generated Content (AI writer documents) ───────────────────────────────────
create table if not exists generated_content (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  team_id      uuid references teams(id) on delete set null,
  type         text not null default 'article', -- article, blog, email, ad_copy, social, custom
  title        text not null,
  prompt       text,
  content      text not null,
  engine       text not null default 'openai',
  model        text not null default 'gpt-4o-mini',
  words        int,
  tokens       int,
  is_favourite boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Fine-tuning Jobs ──────────────────────────────────────────────────────────
create table if not exists fine_tune_jobs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  provider_job_id      text,             -- e.g. OpenAI ftjob-...
  base_model           text not null,
  fine_tuned_model     text,             -- filled when complete
  training_file_id     text,
  status               text not null default 'pending' check (status in ('pending','running','succeeded','failed','cancelled')),
  training_examples    int,
  epochs               int,
  error_message        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── Usage Logs ────────────────────────────────────────────────────────────────
create table if not exists usage_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  feature      text not null,  -- 'chat','image','tts','content'
  engine       text,
  model        text,
  tokens_in    int,
  tokens_out   int,
  images       int,
  tts_chars    int,
  credits_used numeric(10,4) not null default 0,
  created_at   timestamptz not null default now()
);

-- ── Admin Settings Row ────────────────────────────────────────────────────────
insert into ai_settings (key, value, is_secret) values
  ('default_chat_engine',  'openai',       false),
  ('default_chat_model',   'gpt-4o-mini',  false),
  ('default_image_engine', 'openai',       false),
  ('default_tts_engine',   'openai',       false),
  ('max_tokens_per_request', '4096',       false),
  ('enable_image_gen',     'true',         false),
  ('enable_tts',           'true',         false),
  ('enable_chat',          'true',         false),
  ('enable_content_writer','true',         false)
on conflict (key) do nothing;

-- RLS
alter table teams            enable row level security;
alter table team_members     enable row level security;
alter table ai_chats         enable row level security;
alter table ai_chat_messages enable row level security;
alter table ai_personas      enable row level security;
alter table generated_images enable row level security;
alter table generated_tts    enable row level security;
alter table generated_content enable row level security;
alter table fine_tune_jobs   enable row level security;
alter table prompt_templates enable row level security;
alter table usage_logs       enable row level security;

-- Basic ownership policies
create policy "own_teams"       on teams            for all using (owner_id = auth.uid());
create policy "team_member_access" on team_members  for all using (user_id = auth.uid());
create policy "own_chats"       on ai_chats         for all using (user_id = auth.uid());
create policy "own_messages"    on ai_chat_messages for all using (
  chat_id in (select id from ai_chats where user_id = auth.uid())
);
create policy "own_personas"    on ai_personas      for all using (user_id = auth.uid() or is_public);
create policy "own_images"      on generated_images for all using (user_id = auth.uid());
create policy "own_tts"         on generated_tts    for all using (user_id = auth.uid());
create policy "own_content"     on generated_content for all using (user_id = auth.uid());
create policy "own_finetune"    on fine_tune_jobs   for all using (user_id = auth.uid());
create policy "own_prompts"     on prompt_templates for all using (user_id = auth.uid() or is_public);
create policy "own_usage"       on usage_logs       for all using (user_id = auth.uid());
