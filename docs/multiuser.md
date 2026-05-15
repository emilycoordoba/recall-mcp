# Multiusuario

El sistema pasó de un solo usuario (un `MCP_API_KEY`, un Basic auth) a varios
usuarios reales, identificados por token.

## Modelo

- Tabla `users` (`id`, `name`, `mcp_token` único, `dashboard_user`,
  `dashboard_pass`, `created_at`).
- Columna `user_id` (FK → `users.id`, NOT NULL) en 7 tablas que se consultan
  directamente: `topics`, `topic_groups`, `topic_subsections`, `recalls`,
  `quick_review_sessions`, `review_sessions`, `review_session_slots`.
- Las "nietas" (`recall_subsections`, `quick_review_answers`) **no** tienen
  `user_id`: siempre se acceden vía un padre ya scopeado (recall/sesión), con
  inner join al padre cuando la query es directa.
- Unicidad de `topics.name` y `topic_groups.name` pasó de **global** a
  **por usuario, case-insensitive**: índices `topics_user_name_uniq` y
  `topic_groups_user_name_uniq` sobre `(user_id, lower(name))`.

## Autenticación

- **MCP** (`pages/api/mcp.ts`): el Bearer token se resuelve contra
  `users.mcp_token` → `user.id`, que se pasa a `createMcpServer(userId)` y de ahí
  a cada tool y a cada función de `db-mcp.ts`.
- **Dashboard** (`middleware.ts`): Basic auth se resuelve contra
  `users.dashboard_user`/`dashboard_pass`; el `user_id` se propaga por el header
  `x-recall-user-id`. Server Components y route handlers lo leen con
  `currentUserId()` (`lib/auth.ts`) y lo pasan a cada función de `db.ts`.

## Usuarios actuales

- **Emily** (id 1): dueña de todos los datos previos a la migración. Su
  `mcp_token` es el `MCP_API_KEY` anterior (Claude Desktop sigue sin cambios).
  Dashboard: `emily` / contraseña anterior.
- **Lesty** (id 2): nueva. Token y credenciales de dashboard generados aparte
  (no en el repo). Sin datos aún.

## Aislamiento — verificado / pendiente

- ✅ Esquema: backfill correcto (Emily 54 topics/69 recalls; Lesty 0). Unicidad
  por-usuario probada vía SQL (cross-user permitido, same-user bloqueado).
- ⏳ Typecheck de TS: no ejecutado.
- ⏳ Prueba funcional end-to-end con dos tokens: pendiente.

## Deuda conocida

- **RLS deshabilitado** en las 9 tablas (aviso crítico de Supabase). El
  aislamiento es **a nivel de aplicación** (`.eq("user_id", …)` en cada query).
  Un query sin filtrar = fuga entre usuarios. Mitigación real = RLS, que requiere
  que la DB conozca al usuario → llega con Supabase Auth (aplazado). Aceptable
  para 2 usuarias de confianza; **revisar antes de cualquier signup público**.
  SQL de remediación (no aplicar sin políticas):
  `ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;` para las 9 tablas.
- `dashboard_pass` se guarda en **texto plano** (paridad con el esquema previo de
  contraseña única por env). Hashear cuando se aborde Supabase Auth.

## Backup

Antes de la migración se hizo un volcado lógico de todas las tablas en
`backups/` (gitignored). Supabase además tiene snapshots automáticos.
