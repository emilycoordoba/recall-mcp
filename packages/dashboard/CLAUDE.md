# dashboard

Next.js 16 (App Router) con dos responsabilidades:
1. **Frontend**: visualiza el progreso de recalls leyendo Supabase.
2. **MCP server HTTP**: expone el MCP server en `/api/mcp` (Pages API, Streamable HTTP). Claude Desktop apunta aquí.

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
| `/api/mcp` (Pages API) | MCP server HTTP — Claude Desktop apunta aquí con Bearer token |
| `/api/oauth/*` | Endpoints OAuth para autenticación del MCP server |

## Archivos clave

```
pages/api/mcp.ts               — endpoint MCP HTTP (Streamable, Pages API)
lib/mcp-server.ts              — definición de tools MCP (usa db-mcp.ts)
lib/db-mcp.ts                  — queries de escritura a Supabase (save_recall, etc.)
lib/db.ts                      — queries de lectura a Supabase (dashboard)
lib/supabase.ts                — cliente Supabase compartido
app/page.tsx                   — página principal (Server Component)
app/topics/[id]/page.tsx       — detalle del topic (Server Component)
components/dashboard-filters.tsx — filtros de grupo y sort (Client Component)
components/ui/                 — shadcn/ui (Badge, Button, Card, Select, Table)
```

## Gotchas

**Dos libs de DB separadas por intención**: `lib/db.ts` es solo lectura (dashboard), `lib/db-mcp.ts` es escritura (MCP tools). Mantenerlas separadas evita exponer operaciones de escritura desde el frontend.

**`/api/mcp` usa Pages API, no App Router** — el Streamable HTTP transport del MCP SDK necesita acceso al request/response crudos sin el body parser de Next.js. App Router no lo soporta bien.

**Sorting del lado del servidor** — la página principal recibe `searchParams` y ordena en el Server Component. `DashboardFilters` solo actualiza los query params via router.

**zod debe ir alineado con el del MCP SDK** — `lib/mcp-server.ts` pasa schemas de zod a `server.tool()` del `@modelcontextprotocol/sdk`. Si el dashboard resuelve una versión de zod (p.ej. v3) distinta a la que resuelve el SDK (v4), `tsc` intenta relacionar estructuralmente los `ZodType` de ambas versiones (tipos recursivos enormes) y **explota la memoria → OOM** (`structuredTypeRelatedTo`). Mantener `zod` en el rango que el SDK soporta (`^4`) y deduplicado a una sola versión. Síntoma: `npm run typecheck` se cuelga/crashea con "heap out of memory".

## Stack

- Next.js 16 App Router + Turbopack
- shadcn/ui + Tailwind CSS v4 (Radix vía paquete unificado `radix-ui`)
- Supabase (`@supabase/supabase-js`) — lectura (`lib/db.ts`) y escritura (`lib/db-mcp.ts`)
- `@modelcontextprotocol/sdk` + zod v4 — MCP server HTTP
- @tabler/icons-react
