-- ============================================================
-- Migration 003 — Subscriptions + Usage + Audit
-- ============================================================

-- ── Subscriptions ─────────────────────────────────────────────
create table if not exists public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid references public.accounts(id) on delete cascade,
  tier          text not null default 'basic',
  status        text not null default 'active',
  amount_inr    integer default 0,
  started_at    timestamptz default now(),
  expires_at    timestamptz,
  created_at    timestamptz default now()
);
alter table public.subscriptions enable row level security;
create policy "Users read own subscription" on public.subscriptions
  for select using (
    account_id in (select id from public.accounts where user_id = auth.uid())
  );
create policy "Service role subscriptions" on public.subscriptions for all using (true);

-- ── Usage tracking ─────────────────────────────────────────────
create table if not exists public.usage_events (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid references public.accounts(id) on delete cascade,
  event_type    text not null,
  metadata      jsonb default '{}',
  created_at    timestamptz default now()
);
alter table public.usage_events enable row level security;
create policy "Service role usage" on public.usage_events for all using (true);

-- ── Audit log ─────────────────────────────────────────────────
create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid,
  action        text not null,
  target_table  text,
  target_id     uuid,
  metadata      jsonb default '{}',
  created_at    timestamptz default now()
);
alter table public.audit_log enable row level security;
create policy "Service role audit" on public.audit_log for all using (true);
