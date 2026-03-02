# Supabase setup (sync + backup)

O front-end sincroniza os dados do ERP nas tabelas `erp_states` e `erp_states_backup`.
O PAS salva o estado em `pas_graphs`.
O acesso remoto usa um `workspace_id` salvo em `app_metadata` para permitir que varias
contas compartilhem o mesmo estado.

## 1) Tabelas

Execute no SQL Editor do Supabase:

```sql
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

create table if not exists public.pas_graphs (
  user_id uuid primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.tracking_orders (
  order_id text primary key,
  workspace_id uuid not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists tracking_orders_workspace_idx
  on public.tracking_orders (workspace_id);
```

## 2) RLS + rastreio publico

```sql
alter table public.erp_states enable row level security;
alter table public.erp_states_backup enable row level security;
alter table public.pas_graphs enable row level security;
alter table public.tracking_orders enable row level security;

create policy "erp_states_select" on public.erp_states
  for select using (
    user_id = (select auth.uid())
    or user_id = ((select auth.jwt()) -> 'app_metadata' ->> 'workspace_id')::uuid
  );

create policy "erp_states_insert" on public.erp_states
  for insert with check (
    user_id = (select auth.uid())
    or user_id = ((select auth.jwt()) -> 'app_metadata' ->> 'workspace_id')::uuid
  );

create policy "erp_states_update" on public.erp_states
  for update using (
    user_id = (select auth.uid())
    or user_id = ((select auth.jwt()) -> 'app_metadata' ->> 'workspace_id')::uuid
  )
  with check (
    user_id = (select auth.uid())
    or user_id = ((select auth.jwt()) -> 'app_metadata' ->> 'workspace_id')::uuid
  );

create policy "erp_states_backup_insert" on public.erp_states_backup
  for insert with check (
    user_id = (select auth.uid())
    or user_id = ((select auth.jwt()) -> 'app_metadata' ->> 'workspace_id')::uuid
  );

create policy "pas_graphs read/write own" on public.pas_graphs
  for all using (
    user_id = (select auth.uid())
    or user_id = ((select auth.jwt()) -> 'app_metadata' ->> 'workspace_id')::uuid
  )
  with check (
    user_id = (select auth.uid())
    or user_id = ((select auth.jwt()) -> 'app_metadata' ->> 'workspace_id')::uuid
  );

create policy "tracking_orders_select" on public.tracking_orders
  for select using (
    workspace_id = (select auth.uid())
    or workspace_id = ((select auth.jwt()) -> 'app_metadata' ->> 'workspace_id')::uuid
  );

create policy "tracking_orders_insert" on public.tracking_orders
  for insert with check (
    workspace_id = (select auth.uid())
    or workspace_id = ((select auth.jwt()) -> 'app_metadata' ->> 'workspace_id')::uuid
  );

create policy "tracking_orders_update" on public.tracking_orders
  for update using (
    workspace_id = (select auth.uid())
    or workspace_id = ((select auth.jwt()) -> 'app_metadata' ->> 'workspace_id')::uuid
  )
  with check (
    workspace_id = (select auth.uid())
    or workspace_id = ((select auth.jwt()) -> 'app_metadata' ->> 'workspace_id')::uuid
  );

create policy "tracking_orders_delete" on public.tracking_orders
  for delete using (
    workspace_id = (select auth.uid())
    or workspace_id = ((select auth.jwt()) -> 'app_metadata' ->> 'workspace_id')::uuid
  );

create or replace function public.touch_tracking_orders_updated_at()
returns trigger
language plpgsql
set search_path = public
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
  execute function public.touch_tracking_orders_updated_at();

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
```

## 3) `workspace_id`

- O app usa `app_metadata.workspace_id` quando existe; se nao existir, usa o `id` do usuario.
- `user_metadata` continua para dados de perfil, mas nao entra nas politicas RLS.
- Para compartilhar o mesmo workspace entre contas, defina `app_metadata.workspace_id` nelas.
- Para contas antigas, ajuste o `app_metadata` no painel do Supabase (Authentication -> Users).

Exemplo SQL (service role) para ajustar `app_metadata`:

```sql
update auth.users
set raw_app_meta_data =
  jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{workspace_id}', '"<UUID>"')
where id = '<USER_ID>';
```

## 4) POP (PIN) sync (Edge Function)

O POP sincroniza via uma Edge Function (`supabase/functions/pop-sync`) usando service role.

1) Defina os secrets no Supabase:

```
supabase secrets set \
  SERVICE_ROLE_KEY=... \
  POP_SYNC_KEY=... \
  POP_WORKSPACE_ID=... \
  POP_ALLOWED_ORIGIN=https://pop.seu-dominio.com
```

- `SERVICE_ROLE_KEY`: sua service role key do Supabase.
- `POP_WORKSPACE_ID`: use o `id` do admin atual.
- `POP_SYNC_KEY`: chave simples (>= 32 chars) usada pelo POP.
- `POP_ALLOWED_ORIGIN`: opcional; se omitido, aceita `*`.

2) Deploy da função:

```
supabase functions deploy pop-sync
```

3) No front (Vercel/.env):

```
VITE_POP_SYNC_URL=https://<project>.functions.supabase.co/pop-sync
VITE_POP_SYNC_KEY=... (mesma do POP_SYNC_KEY)
```

> Se `VITE_POP_SYNC_URL` nao for informado, o app tenta derivar a URL a partir de `VITE_SUPABASE_URL`.

## 5) Setup inicial (admin)

Para criar o primeiro admin via link, defina `VITE_SETUP_TOKEN` no `.env` e acesse:

```
https://sua-url/?setup=SEU_TOKEN
```

Se o Supabase estiver com confirmacao de email ligada, confirme o email e faca login.

## 6) Storage (avatars)

Crie um bucket privado chamado `umoya-files` e rode o SQL de politicas em:

```
docs/supabase-storage.sql
```

Se quiser outro nome de bucket, defina `VITE_SUPABASE_BUCKET` no `.env` e na Vercel.

## 7) Seguranca (Auth)

- Ative "Leaked password protection" em Authentication -> Settings -> Passwords.
