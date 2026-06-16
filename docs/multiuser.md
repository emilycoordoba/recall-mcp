# Multiusuario

El sistema pasó de un solo usuario (un `MCP_API_KEY`, un Basic auth) a varios
usuarios reales, identificados por token.

## Modelo

- Tabla `users` (`id`, `name`, `mcp_token` único, `dashboard_user`, `auth_id`
  (FK → `auth.users`), `created_at`). La contraseña ya no vive acá: la maneja
  Supabase Auth (hasheada en `auth.users`). La columna `dashboard_pass` se
  eliminó en D4 (ver `migrations/2026-06-15_drop-dashboard-pass.sql`).
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
  **email + contraseña**, validados contra Supabase Auth (`getUserByAuthCreds`).
  El `user.id` se firma dentro del `code` (HMAC con `MCP_API_KEY` como secreto de
  firma del servidor) y `/api/oauth/token` devuelve el `mcp_token` **de ese
  usuario** (`getMcpTokenByUserId`). `client_credentials` exige que el secreto sea
  un `mcp_token` válido y lo devuelve tal cual. Antes el OAuth era single-user
  (devolvía siempre `MCP_API_KEY`) — corregido.
- **Dashboard** (`middleware.ts`): sesión de **Supabase Auth** (cookies SSR); el
  `user_id` (de `app_metadata.app_user_id`) se propaga por el header
  `x-recall-user-id`. Server Components y route handlers lo leen con
  `currentUserId()` (`lib/auth.ts`) y lo pasan a cada función de `db.ts`.

## Usuarios actuales

- **Emily** (id 1): dueña de todos los datos previos a la migración. Su
  `mcp_token` es el `MCP_API_KEY` anterior (Claude Desktop sigue sin cambios).
  Dashboard: login con email (`emilycoordoba@gmail.com`) vía Supabase Auth.
- **Lesty** (id 2): login con email (`lesty.cordoba@gmail.com`) vía Supabase Auth.
  `mcp_token` generado aparte (no en el repo).

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
- ✅ ~~`dashboard_pass` en texto plano~~ — **resuelto en D4**: ni el dashboard ni
  el OAuth/MCP lo leen ya. El login (`/login`) y el `/authorize` validan contra
  Supabase Auth (`getUserByAuthCreds`, que hashea internamente);
  `getUserByDashboardCreds` se eliminó. La columna sigue en la DB pero sin uso:
  el DROP destructivo está en `migrations/2026-06-15_drop-dashboard-pass.sql`
  (correr tras deploy de D4 + snapshot). `scripts/seed-auth-users.mjs` quedó
  obsoleto. Signup público en `/signup`.

## Backup

Antes de la migración se hizo un volcado lógico de todas las tablas en
`backups/` (gitignored). Supabase además tiene snapshots automáticos.
