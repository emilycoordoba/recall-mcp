# Track D — Supabase Auth + RLS (híbrido)

Endurecimiento de seguridad: pasar de Basic auth con `dashboard_pass` en texto
plano + RLS deshabilitado, a **Supabase Auth** para el dashboard y **RLS real**
en todas las tablas, manteniendo el **MCP por token** (service-role).

## Decisión de arquitectura

**Híbrido**, decidido con la dueña:

- **Dashboard** → Supabase Auth (`@supabase/ssr`): login/signup reales, sesiones
  en cookies, reset de contraseña. Las queries de lectura corren con la sesión
  del usuario → **RLS aplica** (`auth.uid()`).
- **MCP** (`pages/api/mcp.ts`) → sigue con Bearer token (`users.mcp_token`).
  Claude Desktop es un cliente de máquina, no hace login interactivo. Las queries
  del MCP usan el **service-role key**, que **salta RLS**; el aislamiento ahí
  sigue siendo a nivel app (`.eq("user_id", …)`), igual que hoy. El token ya
  controla a qué usuario pertenece la sesión MCP.
- **RLS** → activado en las 9 tablas con políticas que resuelven
  `auth.uid()` → `users.id`.

### Por qué NO migramos `user_id` a uuid

`user_id` es `bigint` → `users.id` en 8 tablas + 2 nietas vía padre. Migrarlo a
uuid reescribiría FKs en todo el esquema (invasivo y arriesgado). En su lugar:

- Se agrega **`users.auth_id uuid`** (FK → `auth.users.id`, único). Es el puente
  entre el usuario de Supabase Auth y la fila de perfil `users` (con su `id` int,
  su `mcp_token`, etc.).
- Las políticas RLS usan un helper `public.app_uid()` que mapea
  `auth.uid()` (uuid del JWT) → `users.id` (int). Las tablas de datos NO cambian.

```sql
create or replace function public.app_uid() returns bigint
  language sql stable security definer set search_path = public
as $$ select id from public.users where auth_id = auth.uid() $$;
```

## Clientes de Supabase (tres, por intención)

| Módulo | Key | RLS | Uso |
|---|---|---|---|
| `lib/supabase-admin.ts` | service_role | **salta** | MCP (`db-mcp.ts`, `getUserByToken`), seed/admin, signup |
| `lib/supabase-server.ts` | anon + sesión del usuario (cookies SSR) | **aplica** | dashboard (`db.ts`), por request |
| `lib/supabase-middleware.ts` | anon + cookies (Edge) | n/a | middleware: refresca sesión, resuelve usuario |

> `lib/supabase.ts` (anon global, sin sesión) queda obsoleto: bajo RLS no vería
> ninguna fila. Se reemplaza por los de arriba.

## Slices (orden de ejecución, cada uno verificable)

- **D1 — Fundación (no destructiva).** ✅ en esta rama:
  - Migración `2026-06-14_auth-id.sql`: agrega `users.auth_id` (nullable) +
    índice único. Correr en Supabase SQL editor.
  - `lib/supabase-admin.ts` (service-role). Requiere env `SUPABASE_SERVICE_ROLE_KEY`.
  - Script `scripts/seed-auth-users.mjs`: crea usuarios en `auth.users` a partir
    de las credenciales existentes (`dashboard_user`/`dashboard_pass`) y linkea
    `auth_id`. Idempotente. Requiere service_role key + emails.
- **D2 — Login Supabase Auth en el dashboard.** ✅ en esta rama:
  - `@supabase/ssr` + `supabase-server.ts` / `supabase-middleware.ts`.
  - Página `/login` (Server Component + Server Action) y logout (`/auth/signout`,
    botón "Salir"); middleware valida sesión y redirige (reemplaza Basic).
  - `currentUserId()` lee `users.id` del header que pone el middleware, resuelto
    de `app_metadata.app_user_id` (sin query a la DB).
  - MCP/`db-mcp.ts` pasan a `supabase-admin` (service-role).
  - **Verificado**: redirects de rutas protegidas → `/login`; `signInWithPassword`
    OK para ambas con `app_user_id` == `users.id` (aún pre-RLS).
  - Pendiente para D3: `db.ts` sigue usando el anon global de `lib/supabase.ts`
    (válido pre-RLS); su cambio al cliente con sesión va junto con activar RLS.
  - `/signup` se difiere a D4 (signup público).
- **D3 — Activar RLS.** ✅ completo:
  - Refactor RLS-ready: `db.ts` → `getServerSupabase()` (cliente con sesión, por
    request) y `auth-shared` → `supabase-admin` (service-role). `lib/supabase.ts`
    (anon global) eliminado.
  - Migración `2026-06-14_rls-policies.sql` aplicada (helper `app_uid()` +
    políticas + `enable row level security` en las 11 tablas).
  - **Verificado a nivel DB**: una sesión consultando `topics` sin filtro
    `user_id` ve solo sus filas (Emily 57, Lesty 42, 0 cruzadas). Dashboard y MCP
    siguen funcionando (MCP por service-role salta RLS).
- **D4 — Signup público + limpieza.** `/signup` crea auth user + fila `users` +
  `mcp_token`. Eliminar columna `dashboard_pass`. Actualizar `docs/multiuser.md`.

## Tablas y scoping para RLS

Con `user_id` directo (política `user_id = app_uid()`):
`topics`, `topic_groups`, `topic_subsections`, `topic_group_links`, `recalls`,
`quick_review_sessions`, `review_sessions`, `review_session_slots`.

Nietas (sin `user_id`, política vía padre con `exists`):
- `recall_subsections` → `recalls` (`recall_id`)
- `quick_review_answers` → `quick_review_sessions` (`session_id`)

`users`: política `select` propia (`auth_id = auth.uid()`); insert/update solo
por service-role (signup/admin).

## Riesgo y reversibilidad (datos reales de Lesty)

- `auth_id` (add column) y crear `auth.users` son **aditivos / reversibles**.
- Activar RLS es **reversible** (`disable row level security`). Se activa tabla
  por tabla, verificando el dashboard en cada paso; el MCP no se afecta.
- Lo único destructivo (D4: `drop column dashboard_pass`) va al final, con
  snapshot de Supabase confirmado antes.

## Inputs necesarios de la dueña

D1–D2 ya quedaron resueltos:
1. ~~`SUPABASE_SERVICE_ROLE_KEY` en `.env.local`~~ ✅
2. ~~Emails~~ ✅ Emily `emilycoordoba@gmail.com`, Lesty `lesty.cordoba@gmail.com`.
3. ~~Login pasa de usuario a email~~ ✅ (la página `/login` pide email).
4. ~~Correr `2026-06-14_auth-id.sql`~~ ✅ (columna `auth_id` creada y sembrada).

Para **D3** (activar RLS), antes de correr `2026-06-14_rls-policies.sql`:
- Confirmar **snapshot/backup de Supabase** (datos reales de Lesty).
- Tener el dashboard a mano para verificar tabla por tabla tras cada `enable`.
