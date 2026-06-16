-- Track D (D4) — eliminar la columna `users.dashboard_pass` (texto plano).
--
-- ⚠️ DESTRUCTIVO E IRREVERSIBLE. Correr SOLO cuando:
--   1. El código de D4 esté DESPLEGADO en producción (el flujo OAuth /authorize ya
--      valida con Supabase Auth y NO lee dashboard_pass). Si se dropea antes del
--      deploy, el /authorize viejo en prod rompe al intentar leer la columna.
--   2. Haya snapshot/backup de Supabase confirmado (datos reales de Lesty).
--
-- Contexto: con Supabase Auth, las contraseñas viven hasheadas en auth.users. La
-- columna dashboard_pass (texto plano) quedó sin uso tras D4. `dashboard_user` se
-- conserva (es el identificador legible que muestra el perfil); solo se elimina la
-- contraseña en claro.
--
-- Pre-check (debe dar 0 — nadie depende ya de la columna en el código desplegado):
--   nada en el repo lee `dashboard_pass` salvo scripts/seed-auth-users.mjs (one-time,
--   ya ejecutado en D1; queda obsoleto tras este drop).

alter table public.users drop column if exists dashboard_pass;
