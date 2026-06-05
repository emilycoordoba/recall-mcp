# recall — monorepo

Sistema de active recall personal. Claude Desktop explica temas, el usuario hace recall libre, y el sistema registra el progreso a lo largo del tiempo.

## Estructura

```
recall-mcp/
├── packages/
│   ├── mcp-server/   — MCP server legacy (stdio + SQLite). YA NO SE USA.
│   └── dashboard/    — Next.js: frontend + MCP server HTTP + Supabase
├── package.json      — workspace root (npm workspaces)
└── CLAUDE.md
```

## Arquitectura actual

```
Claude Desktop ──HTTP──▶ Vercel (/api/mcp) ──▶ Supabase ◀── Dashboard (lectura)
```

- El MCP server vive en `packages/dashboard/pages/api/mcp.ts` (HTTP, Streamable MCP)
- La lógica de tools está en `packages/dashboard/lib/mcp-server.ts`
- Las queries a Supabase están en `packages/dashboard/lib/db-mcp.ts` (escritura) y `lib/db.ts` (lectura dashboard)
- `packages/mcp-server/` es código legacy (stdio + SQLite), no se usa
- **Multiusuario**: cada usuario se identifica por token (MCP) o Basic auth (dashboard) contra la tabla `users`; todos los datos se filtran por `user_id`. Ver `docs/multiuser.md`. Deuda: RLS deshabilitado, aislamiento solo a nivel app.

## Cómo funciona el sistema

```
Claude Desktop explica algo
  → save_topic_subsections()   — persiste tabla de contenido ANTES del recall
  → "¿qué recuerdas?"
  → usuario responde libremente
  → save_recall()              — guarda transcript, feedback y scores
  → dashboard visualiza el progreso
```

## Comandos desde la raíz

```bash
npm install                  # instala todo
npm run dev:dashboard        # dev server (puerto 3000)
npm run start:dashboard      # producción en 0.0.0.0
```

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

El system prompt está en `packages/dashboard/SYSTEM_PROMPT.md`.

## Producción (Vercel)

El repo tiene remote en GitHub: `origin` → `https://github.com/emilycodesoft/recall-mcp`.
El proyecto está enlazado a Vercel (`recall-mcp`, ver `packages/dashboard/.vercel/project.json`).

Deploy manual con la CLI de Vercel:

```bash
cd packages/dashboard
vercel deploy --prod   # despliega a producción
```

**Deploy automático (opcional):** conectar la integración de Git de Vercel
(Settings → Git → Connect `emilycodesoft/recall-mcp`, Production Branch = `main`).
Como es monorepo, fijar **Root Directory = `packages/dashboard`** en Settings → General.
Con eso: push a `main` → producción; otras ramas/PRs → preview deployments.

Variables de entorno necesarias:
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — conexión a Supabase
- `MCP_API_KEY` — token Bearer que usa Claude Desktop
- `DASHBOARD_USER` / `DASHBOARD_PASS` — Basic auth para la UI

```bash
pm2 logs recall-dashboard --lines 20   # logs si hay instancia local
```
