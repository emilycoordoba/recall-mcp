-- Per-user preferences (Track A: filtro de repaso + settings).
-- Almacén flexible: nuevas preferencias se agregan como claves del jsonb sin
-- más migraciones. El código (lib/db-mcp.ts DEFAULT_SETTINGS) rellena claves
-- ausentes, así que las filas existentes con '{}' se comportan con los defaults.
--
-- Correr en el SQL editor de Supabase (o psql) una sola vez.

alter table public.users
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- Claves usadas hoy:
--   review_only_practiced (bool, default true en la app):
--     true  → los temas con 0 sesiones quedan fuera del plan de repaso y se
--             devuelven en `new_topics`.
--     false → comportamiento anterior (los temas nuevos pueden entrar al plan).
