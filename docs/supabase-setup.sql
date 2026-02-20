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

create table if not exists public.tracking_orders (
  order_id text primary key,
  workspace_id uuid not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists tracking_orders_workspace_idx
  on public.tracking_orders (workspace_id);

alter table public.tracking_orders enable row level security;

create policy "tracking_orders_select" on public.tracking_orders
  for select using (
    workspace_id = auth.uid()
    or workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::uuid
  );

create policy "tracking_orders_insert" on public.tracking_orders
  for insert with check (
    workspace_id = auth.uid()
    or workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::uuid
  );

create policy "tracking_orders_update" on public.tracking_orders
  for update using (
    workspace_id = auth.uid()
    or workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::uuid
  )
  with check (
    workspace_id = auth.uid()
    or workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::uuid
  );

create policy "tracking_orders_delete" on public.tracking_orders
  for delete using (
    workspace_id = auth.uid()
    or workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::uuid
  );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tracking_orders_set_updated_at on public.tracking_orders;
create trigger tracking_orders_set_updated_at
  before update on public.tracking_orders
  for each row
  execute function public.set_updated_at();

create or replace function public.get_tracking_order(p_order_id text)
returns table (payload jsonb, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select payload, updated_at
  from public.tracking_orders
  where order_id = lower(trim(p_order_id))
  limit 1;
$$;

grant execute on function public.get_tracking_order(text) to anon, authenticated;
