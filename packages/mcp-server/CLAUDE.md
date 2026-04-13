# mcp-server

MCP server en Node/TypeScript que se conecta a Claude Desktop. Persiste topics, subsecciones y recalls en SQLite.

## Comandos

```bash
npm run build        # compilar TypeScript → dist/
npm start            # correr dist/index.js
npm run dev          # compilar + correr (no watch)
```

Desde la raíz del monorepo: `npm run build:mcp`

## Archivos clave

```
src/
├── db.ts       — SQLite con better-sqlite3: schema, queries, transactions
└── index.ts    — MCP server: definición de tools con zod
```

La BD vive en `~/.recall-mcp/recall.db` (fuera del repo, compartida con el dashboard).

## Schema de la BD

```sql
topic_groups      (id, name, created_at)
topics            (id, name, description, group_id, created_at)
topic_subsections (id, topic_id, name, order_index)   ← canónicas, estables
recalls           (id, topic_id, recalled_at, transcript, feedback, overall_score)
recall_subsections(id, recall_id, subsection_id, covered INTEGER, score REAL)
```

**Distinción clave:**
- `topic_subsections` = tabla de contenido del tema. Se define una vez, relativamente estable.
- `recall_subsections` = resultado de una sesión específica. Una fila por recall × subsección.

## Tools expuestas al MCP

| Tool | Cuándo se llama |
|---|---|
| `find_topic` | Antes de cualquier save — detectar duplicados por nombre |
| `save_topic_subsections` | Justo después de generar la tabla de contenido, **antes** del recall |
| `save_recall` | Después de que el usuario hace el recall |
| `get_topic` | Para ver historial completo de un topic |
| `list_topics` | Lista todos los topics con última puntuación y fecha |
| `filter_topics` | Ordena por score, fecha o nombre |
| `update_subsection_name` | Corrige nombre de subsección si Claude se equivocó |

## Decisiones de diseño

**`save_topic_subsections` va ANTES del recall** — la tabla de contenido queda como verdad absoluta antes de que el usuario hable. Evita que Claude "contamine" la evaluación con lo que el usuario dijo.

**`save_recall` no retorna si el topic no existe** — el fallback crea el topic Y continúa hacia el INSERT del recall. Bug histórico: antes retornaba temprano devolviendo `{ topic_id, subsections }` sin `recall_id`.

**La detección de duplicados la hace Claude, no el MCP** — `find_topic` hace búsqueda LIKE textual. Claude decide si "producto punto" y "np.dot" son el mismo concepto.

## Escala de calificación

**0.0 a 5.0** con decimales (escala colombiana). 3.0 = suficiente, 5.0 = perfecto.

## Escala de logs

Los logs van a `stderr` para no interferir con el protocolo MCP (que usa `stdout`).
