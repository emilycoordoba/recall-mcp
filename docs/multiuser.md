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
- **OAuth** (`/api/oauth/*`, lo usa Claude Desktop): la página `/authorize` pide
  **usuario + contraseña**, validados contra `users` (`getUserByDashboardCreds`).
  El `user.id` se firma dentro del `code` (HMAC con `MCP_API_KEY` como secreto de
  firma del servidor) y `/api/oauth/token` devuelve el `mcp_token` **de ese
  usuario** (`getMcpTokenByUserId`). `client_credentials` exige que el secreto sea
  un `mcp_token` válido y lo devuelve tal cual. Antes el OAuth era single-user
  (devolvía siempre `MCP_API_KEY`) — corregido.
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

## Aislamiento — verificado

- ✅ Esquema: backfill correcto. Unicidad por-usuario probada vía SQL.
- ✅ **RLS activo y verificado** (Track D, ver `docs/track-d-auth.md`). Prueba a
  nivel DB: una sesión consultando `topics` **sin** filtro `user_id` recibe solo
  sus filas (Emily 57, Lesty 42, 0 cruzadas). El aislamiento ya NO depende solo
  de la app: lo impone Postgres vía las políticas `user_id = app_uid()`.

## Deuda conocida

- ✅ ~~RLS deshabilitado~~ — **resuelto en Track D**: RLS activo en las 11 tablas
  (9 con `user_id` directo + 2 nietas vía padre), políticas `user_id = app_uid()`,
  y el dashboard usa el cliente con sesión. El MCP usa `service_role` (salta RLS);
  su token ya scopea al usuario. `.eq("user_id", …)` se mantiene en las queries
  como defensa en profundidad. **Ya seguro para signup público** (pendiente D4).
- `dashboard_pass` aún en **texto plano**: lo usa solo el path OAuth/MCP
  (`getUserByDashboardCreds`). El login del dashboard ya pasó a Supabase Auth (que
  hashea internamente). Eliminar la columna y migrar OAuth → D4.

## Backup

Antes de la migración se hizo un volcado lógico de todas las tablas en
`backups/` (gitignored). Supabase además tiene snapshots automáticos.
