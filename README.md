# recall

Sistema de active recall personal. Un MCP server que se conecta a Claude Desktop para registrar lo que aprendes y cómo lo recuerdas con el tiempo. Un dashboard Next.js visualiza tu progreso.

## Cómo funciona

Claude Desktop explica algo → genera una tabla de contenido → te pregunta qué recuerdas → evalúa tu respuesta → guarda el resultado. Con el tiempo puedes ver qué temas dominas y cuáles necesitas repasar.

## Estructura

```
packages/
├── mcp-server/   — MCP server (Node/TypeScript + SQLite)
└── dashboard/    — Frontend (Next.js 16, shadcn/ui)
```

## Setup

```bash
# 1. Instalar todo
npm install

# 2. Compilar el MCP server
npm run build:mcp

# 3. Verificar que funciona
node packages/mcp-server/dist/index.js
# Deberías ver: [recall-mcp] Servidor iniciado. BD en ~/.recall-mcp/recall.db
# Ctrl+C para salir
```

## Conectar a Claude Desktop

Edita `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "recall-mcp": {
      "command": "node",
      "args": ["C:\\Users\\<tu-usuario>\\recall-mcp\\packages\\mcp-server\\dist\\index.js"]
    }
  }
}
```

Reinicia Claude Desktop. El servidor aparece en el ícono de herramientas.

Copia el contenido de `packages/mcp-server/SYSTEM_PROMPT.md` en Settings → Profile → Custom instructions.

## Correr el dashboard

```bash
npm run dev:dashboard      # dev (puerto 3000)
npm run start:dashboard    # producción (0.0.0.0)
```

El dashboard lee la BD en `~/.recall-mcp/recall.db` en modo readonly. Requiere que el MCP server haya corrido al menos una vez para que exista la BD.

## Tools del MCP

| Tool | Descripción |
|---|---|
| `find_topic` | Busca topics existentes — usar antes de guardar para detectar duplicados |
| `save_topic_subsections` | Persiste la tabla de contenido antes del recall |
| `save_recall` | Guarda transcript, feedback y puntuaciones por subsección |
| `get_topic` | Historial completo de un topic |
| `list_topics` | Lista todos los topics con última puntuación y fecha |
| `filter_topics` | Filtra/ordena por score, fecha o nombre |
| `update_subsection_name` | Corrige el nombre de una subsección |

## Base de datos

SQLite en `~/.recall-mcp/recall.db` — un solo archivo, nada que configurar.

```
topic_groups → topics → topic_subsections  (tabla de contenido canónica)
                     ↘
                       recalls → recall_subsections  (resultado por sesión)
```
