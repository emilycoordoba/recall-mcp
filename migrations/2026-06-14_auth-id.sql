-- Track D (D1) — puente entre Supabase Auth y la tabla de perfil `users`.
--
-- No destructiva: agrega `users.auth_id` (uuid) que apunta a `auth.users.id`.
-- Mantiene `users.id` (bigint) y todas las FKs `user_id` de las 9 tablas intactas;
-- las políticas RLS (ver 2026-06-14_rls-policies.sql) resolverán
-- auth.uid() → users.id a través de esta columna. Nullable por ahora: se llena al
-- seedear/crear cada usuario en auth.users (scripts/seed-auth-users.mjs).

alter table public.users
  add column if not exists auth_id uuid references auth.users(id) on delete set null;

-- Único cuando está presente (cada usuario de Auth mapea a un solo perfil).
create unique index if not exists users_auth_id_uniq
  on public.users(auth_id)
  where auth_id is not null;
