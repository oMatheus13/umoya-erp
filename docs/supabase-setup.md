# Supabase setup (sync + backup)

O front-end sincroniza os dados do ERP nas tabelas `erp_states` e `erp_states_backup`.
O acesso remoto usa um `workspace_id` salvo em `user_metadata` para permitir que varias
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
```

## 2) RLS

```sql
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
```

## 3) `workspace_id`

- O app usa `user_metadata.workspace_id` quando existe; se nao existir, usa o `id` do usuario.
- Ao criar novas contas em RH -> Funcionarios, o app grava o mesmo `workspace_id` nelas.
- Para contas antigas, ajuste manualmente o metadata no painel do Supabase (Authentication).

## 4) Setup inicial (admin)

Para criar o primeiro admin via link, defina `VITE_SETUP_TOKEN` no `.env` e acesse:

```
https://sua-url/?setup=SEU_TOKEN
```

Se o Supabase estiver com confirmacao de email ligada, confirme o email e faca login.

## 5) Storage (avatars)

Crie um bucket privado chamado `umoya-files` e rode o SQL de politicas em:

```
docs/supabase-storage.sql
```

Se quiser outro nome de bucket, defina `VITE_SUPABASE_BUCKET` no `.env` e na Vercel.
