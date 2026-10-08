create extension if not exists pgcrypto;

create table if not exists public.instagram_accounts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 instagram_user_id text not null unique,
 username text,name text,profile_picture_url text,access_token text,token_expires_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

create table if not exists public.instagram_media (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.instagram_accounts(id) on delete cascade,
 instagram_media_id text not null unique,
 media_type text,media_product_type text,permalink text,caption text,media_url text,thumbnail_url text,
 published_at timestamptz,duration_seconds numeric,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

create table if not exists public.instagram_media_insights (
 id uuid primary key default gen_random_uuid(),
 media_id uuid not null references public.instagram_media(id) on delete cascade,
 captured_at timestamptz not null default now(),
 views bigint,reach bigint,likes bigint,comments bigint,shares bigint,saves bigint,total_interactions bigint,
 raw_metrics jsonb not null default '{}'::jsonb,
 unique(media_id,captured_at)
);

create table if not exists public.instagram_account_insights (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.instagram_accounts(id) on delete cascade,
 captured_at timestamptz not null default now(),
 reach bigint,views bigint,follower_count bigint,interactions bigint,
 raw_metrics jsonb not null default '{}'::jsonb,
 unique(account_id,captured_at)
);

create table if not exists public.instagram_sync_runs (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.instagram_accounts(id) on delete cascade,
 started_at timestamptz not null default now(),finished_at timestamptz,status text not null default 'running',
 media_imported integer not null default 0,insights_imported integer not null default 0,error_message text
);

create table if not exists public.instagram_ai_analyses (
 id uuid primary key default gen_random_uuid(),
 media_id uuid not null references public.instagram_media(id) on delete cascade,
 model text,analyzed_at timestamptz not null default now(),hook text,topic text,cta text,why_it_worked text,
 strengths jsonb not null default '[]'::jsonb,recommendations jsonb not null default '[]'::jsonb,raw_analysis jsonb not null default '{}'::jsonb
);

alter table public.instagram_accounts enable row level security;
alter table public.instagram_media enable row level security;
alter table public.instagram_media_insights enable row level security;
alter table public.instagram_account_insights enable row level security;
alter table public.instagram_sync_runs enable row level security;
alter table public.instagram_ai_analyses enable row level security;

create policy "Users can view own Instagram accounts" on public.instagram_accounts for select to authenticated using ((select auth.uid())=user_id);
create policy "Users can manage own Instagram accounts" on public.instagram_accounts for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users can view own media" on public.instagram_media for select to authenticated using (exists(select 1 from public.instagram_accounts a where a.id=account_id and a.user_id=(select auth.uid())));
create policy "Users can view own media insights" on public.instagram_media_insights for select to authenticated using (exists(select 1 from public.instagram_media m join public.instagram_accounts a on a.id=m.account_id where m.id=media_id and a.user_id=(select auth.uid())));
create policy "Users can view own account insights" on public.instagram_account_insights for select to authenticated using (exists(select 1 from public.instagram_accounts a where a.id=account_id and a.user_id=(select auth.uid())));
create policy "Users can view own sync runs" on public.instagram_sync_runs for select to authenticated using (exists(select 1 from public.instagram_accounts a where a.id=account_id and a.user_id=(select auth.uid())));
create policy "Users can view own AI analyses" on public.instagram_ai_analyses for select to authenticated using (exists(select 1 from public.instagram_media m join public.instagram_accounts a on a.id=m.account_id where m.id=media_id and a.user_id=(select auth.uid())));
