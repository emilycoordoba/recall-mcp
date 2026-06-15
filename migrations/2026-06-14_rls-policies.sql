-- Track D (D3) — RLS real, activación INCREMENTAL (tabla por tabla).
--
-- Cada PASO es un bloque independiente: copialo al SQL editor de Supabase, corré,
-- y verificá el dashboard (logueado) antes de pasar al siguiente. Si una tabla
-- "desaparece" del dashboard, la política está mal → revertí ESE paso con su
-- línea de rollback y avisá. RLS no borra ni modifica datos: solo decide quién
-- ve/escribe cada fila.
--
-- Contexto:
--   · Dashboard → cliente con sesión (anon + cookies) → RLS APLICA.
--   · MCP / OAuth → service_role → SALTA RLS (no se afecta).
--   · app_uid() mapea auth.uid() (uuid del JWT) → users.id (bigint).
--
-- ⚠️ Requiere D2 ya en producción (dashboard con Supabase Auth). Pre-D2 el
-- dashboard no tendría sesión y RLS lo dejaría sin ver nada.

-- ════════════════════════════════════════════════════════════════════════════
-- PRE-CHECK (solo lectura — no cambia nada). Confirmá que ambos usuarios tienen
-- auth_id seteado y que el mapeo auth_id → id resuelve. Debe devolver 2 filas
-- con auth_id NO nulo.
-- ════════════════════════════════════════════════════════════════════════════
-- select id, name, auth_id from public.users order by id;


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 0 — Helper app_uid()  (riesgo cero: no toca el acceso a ninguna tabla)
-- security definer: lee `users` aunque tenga RLS. stable: el planner la cachea.
-- Nota: en el SQL editor auth.uid() es NULL (no hay sesión), así que app_uid()
-- devuelve NULL acá. Se prueba de verdad desde el dashboard logueado.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.app_uid() returns bigint
  language sql stable security definer set search_path = public
as $$ select id from public.users where auth_id = auth.uid() $$;

grant execute on function public.app_uid() to authenticated, anon;


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 1 — users  (esperado: SIN efecto visible; el dashboard lee `users` solo
-- por service-role). Escritura (signup/admin) va por service_role → no necesita
-- política de insert/update.
-- Verificar: el dashboard sigue cargando normal tras login.
-- Rollback: alter table public.users disable row level security;
-- ════════════════════════════════════════════════════════════════════════════
alter table public.users enable row level security;
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
  for select using (auth_id = auth.uid());


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 2 — topics  (verificar: la HOME muestra tus temas; cada quien ve solo los
-- suyos). Esta es la más visible: si rompe, la home queda vacía.
-- Rollback: alter table public.topics disable row level security;
-- ════════════════════════════════════════════════════════════════════════════
alter table public.topics enable row level security;
drop policy if exists topics_owner on public.topics;
create policy topics_owner on public.topics
  for all using (user_id = public.app_uid()) with check (user_id = public.app_uid());


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 3 — grupos: topic_groups + topic_group_links  (verificar: las tarjetas de
-- grupos y los chips de grupo por fila siguen apareciendo).
-- Rollback: alter table public.topic_groups disable row level security;
--           alter table public.topic_group_links disable row level security;
-- ════════════════════════════════════════════════════════════════════════════
alter table public.topic_groups enable row level security;
drop policy if exists topic_groups_owner on public.topic_groups;
create policy topic_groups_owner on public.topic_groups
  for all using (user_id = public.app_uid()) with check (user_id = public.app_uid());

alter table public.topic_group_links enable row level security;
drop policy if exists topic_group_links_owner on public.topic_group_links;
create policy topic_group_links_owner on public.topic_group_links
  for all using (user_id = public.app_uid()) with check (user_id = public.app_uid());


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 4 — topic_subsections  (verificar: el detalle de un tema muestra sus
-- subsecciones).
-- Rollback: alter table public.topic_subsections disable row level security;
-- ════════════════════════════════════════════════════════════════════════════
alter table public.topic_subsections enable row level security;
drop policy if exists topic_subsections_owner on public.topic_subsections;
create policy topic_subsections_owner on public.topic_subsections
  for all using (user_id = public.app_uid()) with check (user_id = public.app_uid());


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 5 — recalls + recall_subsections  (verificar: Historial y el detalle de
-- un tema muestran los recalls). recall_subsections no tiene user_id: se scopea
-- vía el recall padre.
-- Rollback: alter table public.recalls disable row level security;
--           alter table public.recall_subsections disable row level security;
-- ════════════════════════════════════════════════════════════════════════════
alter table public.recalls enable row level security;
drop policy if exists recalls_owner on public.recalls;
create policy recalls_owner on public.recalls
  for all using (user_id = public.app_uid()) with check (user_id = public.app_uid());

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


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 6 — quick_review_sessions + quick_review_answers  (verificar: los repasos
-- rápidos aparecen en Historial y en el detalle). quick_review_answers no tiene
-- user_id: se scopea vía la sesión padre.
-- Rollback: alter table public.quick_review_sessions disable row level security;
--           alter table public.quick_review_answers disable row level security;
-- ════════════════════════════════════════════════════════════════════════════
alter table public.quick_review_sessions enable row level security;
drop policy if exists quick_review_sessions_owner on public.quick_review_sessions;
create policy quick_review_sessions_owner on public.quick_review_sessions
  for all using (user_id = public.app_uid()) with check (user_id = public.app_uid());

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


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 7 — review_sessions + review_session_slots  (verificar: la página
-- Sesiones muestra el historial de sesiones de repaso).
-- Rollback: alter table public.review_sessions disable row level security;
--           alter table public.review_session_slots disable row level security;
-- ════════════════════════════════════════════════════════════════════════════
alter table public.review_sessions enable row level security;
drop policy if exists review_sessions_owner on public.review_sessions;
create policy review_sessions_owner on public.review_sessions
  for all using (user_id = public.app_uid()) with check (user_id = public.app_uid());

alter table public.review_session_slots enable row level security;
drop policy if exists review_session_slots_owner on public.review_session_slots;
create policy review_session_slots_owner on public.review_session_slots
  for all using (user_id = public.app_uid()) with check (user_id = public.app_uid());


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN FINAL — confirmar que las 12 tablas quedaron con RLS activo.
-- Debe listar todas con rowsecurity = true.
-- ════════════════════════════════════════════════════════════════════════════
-- select tablename, rowsecurity from pg_tables
-- where schemaname = 'public'
--   and tablename in (
--     'users','topics','topic_groups','topic_group_links','topic_subsections',
--     'recalls','recall_subsections','quick_review_sessions','quick_review_answers',
--     'review_sessions','review_session_slots'
--   )
-- order by tablename;
