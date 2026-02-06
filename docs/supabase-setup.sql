create table if not exists public.erp_states (
  user_id uuid primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_states_backup (
  id bigserial primary key,
  user_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.erp_states enable row level security;
alter table public.erp_states_backup enable row level security;

create policy "erp_states_select" on public.erp_states
  for select using (
    user_id = auth.uid()
    or user_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::uuid
  );

create policy "erp_states_insert" on public.erp_states
  for insert with check (
    user_id = auth.uid()
    or user_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::uuid
  );

create policy "erp_states_update" on public.erp_states
  for update using (
    user_id = auth.uid()
    or user_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::uuid
  )
  with check (
    user_id = auth.uid()
    or user_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::uuid
  );

create policy "erp_states_backup_insert" on public.erp_states_backup
  for insert with check (
    user_id = auth.uid()
    or user_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::uuid
  );
