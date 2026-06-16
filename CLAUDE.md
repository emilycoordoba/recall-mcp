# recall

Sistema de active recall personal. Claude Desktop explica temas, el usuario hace
recall libre, y el sistema registra el progreso a lo largo del tiempo.

App única Next.js 16 (App Router) en la raíz del repo, con dos responsabilidades:
1. **Frontend**: visualiza el progreso de recalls leyendo Supabase.
2. **MCP server HTTP**: expone el MCP server en `/api/mcp` (Pages API, Streamable HTTP). Claude Desktop apunta aquí.

> Antes era un monorepo npm con `packages/dashboard`; se aplanó a un solo paquete
> en la raíz. Si ves rutas `packages/dashboard/...` en docs viejos, son la raíz hoy.

## Arquitectura

```
Claude Desktop ──HTTP──▶ Vercel (/api/mcp) ──▶ Supabase ◀── Dashboard (lectura)
```

- El MCP server vive en `pages/api/mcp.ts` (HTTP, Streamable MCP)
- La lógica de tools está en `lib/mcp-server.ts`
- Las queries a Supabase están en `lib/db-mcp.ts` (escritura) y `lib/db.ts` (lectura dashboard)
- **Multiusuario**: cada usuario se identifica por token (MCP) o **Supabase Auth** (dashboard, login con email) contra la tabla `users`; todos los datos se filtran por `user_id`. Ver `docs/multiuser.md` y `docs/track-d-auth.md`. **RLS activo** en las 11 tablas (aislamiento impuesto por la DB vía `app_uid()`); el MCP usa `service_role` y salta RLS (su token ya scopea al usuario).

## Cómo funciona el sistema

```
Claude Desktop explica algo
  → save_topic_subsections()   — persiste tabla de contenido ANTES del recall
  → "¿qué recuerdas?"
  → usuario responde libremente
  → save_recall()              — guarda transcript, feedback y scores
  → dashboard visualiza el progreso
```

## Comandos

```bash
npm install          # instala todo
npm run dev          # dev server con Turbopack (puerto 3000)
npm run build        # build de producción
npm run start        # producción en 0.0.0.0 (accesible en red local)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run format       # prettier sobre **/*.{ts,tsx}
```

## Rutas

| Ruta | Qué hace |
|---|---|
| `/` | Lista todos los topics con último score, fecha y total de recalls. Filtra por grupo, ordena. **Editable**: renombrar topic inline, fusionar dentro de otro y borrar (acciones por fila al hover); **grupos por fila con chips agregar/quitar** (mismo combobox que el detalle); **selección múltiple** (checkbox por fila + "seleccionar todo") con barra de acciones masivas (agrupar/quitar de un grupo en lote); **borrar un grupo entero** desde su tarjeta de resumen (× al hover; no borra sus topics). |
| `/topics/[id]` | Detalle de un topic. **Editable**: nombre y descripción inline, **grupos (varios) con chips agregar/quitar**, renombrar subsecciones, borrar topic, y borrar/editar feedback de recalls del historial. |
| `/settings` | Ajustes por usuario: "repaso solo con temas estrenados", **cantidad de temas por sesión** (`review_slots`, 2–6, default 4; server-enforced en `get_review_plan`) y **dificultad adaptativa en vivo** (`adaptive_difficulty` + `difficulty_pace` suave/normal/exigente, soft prefs que `get_review_plan` expone para que la IA las honre). Ver `docs/METODOLOGIA.md`. |
| `/prompt` | Muestra las plantillas de system prompt (general/mate) para copiar a Claude Desktop. Estático (sin DB); contenido leído de los `.md` de la raíz. |
| `/login` · `/signup` | Auth del dashboard (Supabase Auth, email+contraseña). `/signup` crea auth user + fila `users` + `mcp_token`. Logout en `/auth/signout` (POST). |
| `/authorize` · `/api/oauth/*` | Flujo OAuth para que Claude Desktop obtenga su Bearer token; valida con Supabase Auth (email+contraseña). |
| `/api/topics/[id]` | `PATCH` (nombre/descripción) · `DELETE` (borrar topic) · `GET`. |
| `/api/topics/[id]/groups` | `POST { name }` (agregar/crear grupo) · `DELETE ?groupId=` (quitar). |
| `/api/topics/merge` | `POST { sourceId, targetId }` — fusiona el origen en el destino. |
| `/api/groups` | `GET` — todos los grupos del usuario (selector). |
| `/api/groups/[id]` | `DELETE` — borra el grupo entero (no sus topics; repunta el primario). |
| `/api/subsections/[id]` | `PATCH { name }` — renombra subsección. |
| `/api/recalls/[id]` | `PATCH { feedback }` · `DELETE`. |
| `/api/settings` | `GET` / `PATCH` ajustes del usuario actual. |
| `/api/mcp` (Pages API) | MCP server HTTP — Claude Desktop apunta aquí con Bearer token |
| `/api/oauth/*` | Endpoints OAuth para autenticación del MCP server |

> **Edición desde el dashboard**: la UI escribe vía route handlers de App Router que delegan en `lib/db-mcp.ts` (no directamente desde el cliente). Inline-edit estándar: click→input, Enter/blur=commit, Esc=cancela, con actualización optimista + `router.refresh()`. Guardar `setEditing(false)` **después** del `await` (no antes) para no desmontar el campo enfocado a mitad del fetch y disparar un doble-commit por el blur resultante.

## Archivos clave

```
pages/api/mcp.ts               — endpoint MCP HTTP (Streamable, Pages API)
lib/mcp-server.ts              — definición de tools MCP (usa db-mcp.ts)
lib/db-mcp.ts                  — queries de escritura a Supabase (save_recall, etc.)
lib/db.ts                      — queries de lectura a Supabase (dashboard)
lib/supabase.ts                — cliente Supabase compartido
app/page.tsx                   — página principal (Server Component)
app/topics/[id]/page.tsx       — detalle del topic (Server Component)
components/dashboard-filters.tsx — lista + filtros + renombrar/fusionar/borrar + grupos por fila + selección múltiple (Client)
components/group-editor.tsx     — GroupCombobox (sin datalist) + GroupChips reutilizables
components/group-stat-cards.tsx — tarjetas de resumen por grupo con borrar grupo (Client)
components/topic-detail-header.tsx — header editable del detalle (nombre, descripción, borrar)
components/subsection-list.tsx — renombrar subsecciones inline
components/topic-sessions.tsx  — historial; borrar recall y editar su feedback
components/settings-form.tsx   — toggle de ajustes por usuario
components/app-header.tsx      — AppHeader: nav común (marca + links + salir + toggle de tema) en todas las páginas
components/theme-toggle.tsx    — toggle claro/oscuro (island; next-themes); en el AppHeader
components/prompt-viewer.tsx   — /prompt: selector de plantilla + copiar (defensivo con clipboard)
lib/prompts.ts                 — registro de plantillas de system prompt (id→.md) + loader fs
components/logo.tsx            — LogoMark + Logo (marca "Recall"); favicon en app/icon.svg
components/confirm-dialog.tsx  — ConfirmProvider + useConfirm() (reemplaza confirm() nativo)
components/ui/sonner.tsx       — Toaster (sonner) para toasts; toast.error()/toast.success()
components/ui/                 — shadcn/ui (Badge, Button, Card, Select, Table)
app/manifest.ts               — Web App Manifest (PWA instalable; iconos en public/ + app/apple-icon.png)
app/**/loading.tsx            — skeletons de Suspense por ruta (imitan el layout real); primitivo en components/ui/skeleton.tsx
app/error.tsx                 — error boundary de ruta (Reintentar)
SYSTEM_PROMPT.md · SYSTEM_PROMPT_MATE.md — plantillas de system prompt (fuente de verdad de /prompt)
```

**Sistema visual**: lenguaje "redondeado y cálido". Radio = un solo token
`--radius` en `globals.css` (Tailwind v4 deriva sm/md/lg); no hardcodear radios
fijos. Feedback in-app (no `alert`/`confirm` nativos): `toast.error()`/`toast.success()`
y `await confirm({…})` vía `useConfirm()`. UI en español (`lang="es"`). Metadata con
`title` template "%s · Recall" en `app/layout.tsx`. **Responsive**: lista de temas
en tabla (≥md) o tarjetas (<md, `MobileTopicCard`). **PWA** instalable vía
`app/manifest.ts` (sin offline). Modo claro/oscuro con `next-themes` (toggle en el
header + atajo `d`). Ver `docs/app.md` → "Sistema visual".

## Configuración Claude Desktop

`%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "recall-mcp": {
      "url": "<VERCEL_URL>/api/mcp",
      "headers": { "Authorization": "Bearer <MCP_API_KEY>" }
    }
  }
}
```

El system prompt está en `SYSTEM_PROMPT.md` (visible también en `/prompt`).

## Producción (Vercel)

El repo tiene remote en GitHub: `origin` → `https://github.com/emilycodesoft/recall-mcp`.
El proyecto está enlazado a Vercel (`recall-mcp`, ver `.vercel/project.json`).

Al estar aplanado, el **Root Directory de Vercel es la raíz del repo** (no
`packages/dashboard`). Deploy manual con la CLI desde la raíz:

```bash
vercel --prod --yes   # despliega a producción → alias https://recall-mcp.vercel.app
```

**Deploy automático (opcional):** conectar la integración de Git de Vercel
(Settings → Git → Connect `emilycodesoft/recall-mcp`, Production Branch = `main`).
Con Root Directory = raíz: push a `main` → producción; otras ramas/PRs → preview.

Variables de entorno necesarias:
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — conexión a Supabase
- `MCP_API_KEY` — token Bearer que usa Claude Desktop
- `DASHBOARD_USER` / `DASHBOARD_PASS` — Basic auth para la UI
- `OAUTH_ALLOWED_REDIRECT_HOSTS` *(opcional)* — hosts extra permitidos como
  `redirect_uri` en el flujo OAuth (coma-separado). Por defecto se permiten
  loopback + `claude.ai`/`claude.com`/`anthropic.com`. Ver `docs/track-d-auth.md` (D5).

## Gotchas

**Dos libs de DB separadas por intención**: `lib/db.ts` es solo lectura (dashboard), `lib/db-mcp.ts` es escritura (MCP tools). Mantenerlas separadas evita exponer operaciones de escritura desde el frontend.

**`/api/mcp` usa Pages API, no App Router** — el Streamable HTTP transport del MCP SDK necesita acceso al request/response crudos sin el body parser de Next.js. App Router no lo soporta bien.

**Grupos muchos-a-muchos con "primario" (Track C)** — un topic puede tener varios grupos vía `topic_group_links`, pero `topics.group_id` se conserva como el grupo **primario** (lo que siguen usando las tools MCP, el plan de repaso y stats; la edición multi-grupo es solo del dashboard). Dos consecuencias:
- **Embeds ambiguos**: al existir dos caminos FK entre `topics` y `topic_groups` (`group_id` directo y vía el join table), PostgREST falla con `PGRST201` en `topic_groups(...)`. Hay que nombrar la FK del primario: `topic_groups!topics_group_id_fkey(name)`. Los grupos completos se leen aparte (`groupsByTopic` en `lib/db.ts`), no por embed.
- **RLS (Track D)**: `topic_group_links` tiene RLS activo con política `user_id = app_uid()`, igual que el resto del esquema. El dashboard lee/escribe con el cliente **con sesión** (`getServerSupabase`), así que `app_uid()` resuelve y las políticas dejan pasar; el MCP usa `service_role` y salta RLS. Si alguna vez una lectura sale vacía en silencio, sospechar de la sesión (sin `auth.uid()` → `app_uid()` NULL → 0 filas), no de la query.

**Sorting del lado del servidor** — la página principal recibe `searchParams` y ordena en el Server Component. `DashboardFilters` solo actualiza los query params via router.

**zod debe ir alineado con el del MCP SDK** — `lib/mcp-server.ts` pasa schemas de zod a `server.tool()` del `@modelcontextprotocol/sdk`. Si el repo resuelve una versión de zod (p.ej. v3) distinta a la que resuelve el SDK (v4), `tsc` intenta relacionar estructuralmente los `ZodType` de ambas versiones (tipos recursivos enormes) y **explota la memoria → OOM** (`structuredTypeRelatedTo`). Mantener `zod` en el rango que el SDK soporta (`^4`) y deduplicado a una sola versión. Síntoma: `npm run typecheck` se cuelga/crashea con "heap out of memory".

## Stack

- Next.js 16 App Router + Turbopack
- shadcn/ui + Tailwind CSS v4 (Radix vía paquete unificado `radix-ui`)
- `sonner` (toasts) + `next-themes` (modo claro/oscuro)
- Supabase (`@supabase/supabase-js`) — lectura (`lib/db.ts`) y escritura (`lib/db-mcp.ts`)
- `@modelcontextprotocol/sdk` + zod v4 — MCP server HTTP
- @tabler/icons-react
