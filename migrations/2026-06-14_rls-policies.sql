-- Track D (D3) — RLS real en las 9 tablas.
--
-- ⚠️ NO correr hasta D2 (dashboard usando Supabase Auth con sesión). Antes de eso,
-- el dashboard consulta con el anon key SIN sesión y RLS lo dejaría sin ver nada.
-- El MCP usa el service_role key, que SALTA RLS, así que no se afecta.
--
-- Reversible: `alter table <t> disable row level security;` por tabla.
-- Recomendado activar tabla por tabla y verificar el dashboard en cada paso.

-- ── Helper: app user id (bigint) del usuario autenticado (auth.uid() → users.id) ──
-- security definer para poder leer `users` aunque tenga RLS; stable para que el
-- planner la cachee por statement.
create or replace function public.app_uid() returns bigint
  language sql stable security definer set search_path = public
as $$ select id from public.users where auth_id = auth.uid() $$;

grant execute on function public.app_uid() to authenticated, anon;

-- ── users: cada quien ve solo su propia fila de perfil ──
-- Escritura (signup/admin) va por service_role, que salta RLS → no hace falta
-- política de insert/update.
alter table public.users enable row level security;
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
  for select using (auth_id = auth.uid());

-- ── Tablas con user_id directo ──
do $$
declare t text;
begin
  foreach t in array array[
    'topics', 'topic_groups', 'topic_subsections', 'topic_group_links',
    'recalls', 'quick_review_sessions', 'review_sessions', 'review_session_slots'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_owner', t);
    execute format(
      'create policy %I on public.%I for all using (user_id = public.app_uid()) with check (user_id = public.app_uid());',
      t || '_owner', t
    );
  end loop;
end $$;

-- ── Nietas (sin user_id): scope vía el padre ya scopeado ──
alter table public.recall_subsections enable row level security;
drop policy if exists recall_subsections_owner on public.recall_subsections;
create policy recall_subsections_owner on public.recall_subsections
  for all
  using (exists (
    select 1 from public.recalls r
    where r.id = recall_subsections.recall_id and r.user_id = public.app_uid()
  ))
  with check (exists (
    select 1 from public.recalls r
    where r.id = recall_subsections.recall_id and r.user_id = public.app_uid()
  ));

alter table public.quick_review_answers enable row level security;
drop policy if exists quick_review_answers_owner on public.quick_review_answers;
create policy quick_review_answers_owner on public.quick_review_answers
  for all
  using (exists (
    select 1 from public.quick_review_sessions s
    where s.id = quick_review_answers.session_id and s.user_id = public.app_uid()
  ))
  with check (exists (
    select 1 from public.quick_review_sessions s
    where s.id = quick_review_answers.session_id and s.user_id = public.app_uid()
  ));
