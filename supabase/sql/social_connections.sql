-- social_connections: one row per (user, platform). Tokens stored server-side
-- only (written by the bm-oauth-callback edge function with the service role).
create table if not exists public.social_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  platform      text not null check (platform in ('twitter','meta','google','reddit')),
  handle        text,
  access_token  text,            -- written by edge function; never selected client-side
  refresh_token text,
  expires_at    timestamptz,
  status        text not null default 'active' check (status in ('active','expired','revoked')),
  connected_at  timestamptz not null default now(),
  unique (user_id, platform)
);

alter table public.social_connections enable row level security;

-- Clients may read only non-secret columns of their own rows.
create policy "own connections readable"
  on public.social_connections for select
  using (auth.uid()::text = user_id);

-- Inserts/updates of tokens happen via the service-role edge function only.
revoke update, insert on public.social_connections from anon, authenticated;
