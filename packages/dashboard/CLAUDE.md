# dashboard

Frontend Next.js 16 (App Router) que visualiza el progreso de recalls. Lee la BD SQLite en modo **readonly** — no escribe nunca.

## Comandos

```bash
npm run dev          # dev server con Turbopack (puerto 3000)
npm run build        # build de producción
npm run start        # producción en 0.0.0.0 (accesible en red local)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run format       # prettier sobre **/*.{ts,tsx}
```

Desde la raíz del monorepo: `npm run dev:dashboard` / `npm run start:dashboard`

## Rutas

| Ruta | Qué hace |
|---|---|
| `/` | Lista todos los topics con último score, fecha y total de recalls. Filtra por grupo, ordena por score/fecha/nombre. |
| `/topics/[id]` | Detalle de un topic: subsecciones canónicas + historial completo de recalls con breakdown por subsección. |

## API Routes

```
app/api/topics/route.ts         GET /api/topics       → lista de topics
app/api/topics/[id]/route.ts    GET /api/topics/:id   → detalle + recalls
```

Ambas tienen `export const dynamic = "force-dynamic"` porque leen SQLite directamente (no hay caché de datos).

## Archivos clave

```
lib/db.ts                      — conexión readonly a ~/.recall-mcp/recall.db + queries
app/page.tsx                   — página principal (Server Component)
app/topics/[id]/page.tsx       — detalle del topic (Server Component)
components/dashboard-filters.tsx — filtros de grupo y sort (Client Component)
components/ui/                 — shadcn/ui (Badge, Button, Card, Select, Table)
```

## Gotchas

**La BD es externa al repo** — vive en `~/.recall-mcp/recall.db`. Si no existe (MCP server nunca corrió), la app lanza error al arrancar.

**Conexión singleton con lazy init** — `lib/db.ts` usa un singleton `_db` que se inicializa en el primer request, no al arrancar el servidor. Esto evita crash en build time cuando la BD no existe.

**Las páginas son Server Components** — leen la BD directamente con `better-sqlite3` (síncrono), sin fetch a la API. Las API routes existen para uso externo/futuro.

**Sorting del lado del cliente** — la página principal recibe `searchParams` y ordena en el Server Component, no en el cliente. `DashboardFilters` solo actualiza los query params via router.

## Stack

- Next.js 16 App Router + Turbopack
- shadcn/ui + Tailwind CSS v4
- better-sqlite3 (readonly)
- @tabler/icons-react
