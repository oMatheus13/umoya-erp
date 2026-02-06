# Supabase reset

Escolha uma das opcoes abaixo para iniciar limpo.

## Opcao 1: limpar apenas dados do ERP

Use no SQL Editor do Supabase:

```sql
delete from public.erp_states_backup;
delete from public.erp_states;
```

## Opcao 2: reset total (dados + contas)

Use no SQL Editor do Supabase (cuidado: apaga todos os usuarios):

```sql
delete from auth.identities;
delete from auth.refresh_tokens;
delete from auth.sessions;
delete from auth.users;

delete from public.erp_states_backup;
delete from public.erp_states;
```

Se algum desses objetos nao existir no seu projeto, remova a linha e rode o restante.

## Opcao 3: novo projeto

1) Crie um novo projeto no Supabase.
2) Atualize `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`.
3) Rode `docs/supabase-setup.sql` no SQL Editor.
4) Abra `/?setup=SEU_TOKEN` para criar o primeiro admin.
