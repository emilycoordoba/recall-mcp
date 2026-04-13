# recall — monorepo

Sistema de active recall personal. Claude Desktop explica temas, el usuario hace recall libre, y el sistema registra el progreso a lo largo del tiempo.

## Estructura

```
recall-mcp/
├── packages/
│   ├── mcp-server/   — MCP server Node/TypeScript (se conecta a Claude Desktop)
│   └── dashboard/    — Frontend Next.js (visualiza el progreso)
├── package.json      — workspace root (npm workspaces)
└── CLAUDE.md
```

## Comandos desde la raíz

```bash
npm install                  # instala todo (hoista dependencias compartidas)
npm run build:mcp            # compilar el MCP server
npm run dev:dashboard        # correr Next.js en dev (puerto 3000)
npm run start:dashboard      # correr Next.js en producción (0.0.0.0)
```

## Cómo funciona el sistema

```
Claude Desktop explica algo
  → save_topic_subsections()   — persiste tabla de contenido ANTES del recall
  → "¿qué recuerdas?"
  → usuario responde libremente
  → save_recall()              — guarda transcript, feedback y scores
  → dashboard visualiza el progreso
```

El MCP server escribe en `~/.recall-mcp/recall.db`. El dashboard la lee en modo readonly.

## Configuración Claude Desktop

`%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "recall-mcp": {
      "command": "node",
      "args": ["C:\\Users\\emily\\recall-mcp\\packages\\mcp-server\\dist\\index.js"]
    }
  }
}
```

El system prompt está en `packages/mcp-server/SYSTEM_PROMPT.md`.

## Producción

```bash
npm run build:mcp                  # recompilar tras cambios al server
pm2 restart recall-dashboard       # reiniciar dashboard
pm2 logs recall-dashboard --lines 20
```
