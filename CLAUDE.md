# recall-mcp

Sistema de active recall personal. Un MCP server en Node/TypeScript que se conecta a Claude Desktop para llevar registro de lo que el usuario aprende y cómo lo recuerda con el tiempo.

## Qué hace el sistema

Cuando Claude Desktop explica algo sustancial, al final del tema pregunta si el usuario quiere hacer un recall. El flujo es:

1. Claude genera una tabla de contenido basada en su propia explicación
2. Llama `save_topic_subsections` para persistirla en la BD **antes** de que el usuario hable
3. Pregunta "¿qué recuerdas?"
4. El usuario responde libremente (sin pistas)
5. Claude evalúa el recall contra la tabla de contenido
6. Llama `save_recall` con transcript, feedback y scores
7. El frontend Next.js visualiza el progreso a lo largo del tiempo

## Estructura del proyecto

```
recall-mcp/
├── src/
│   ├── db.ts        — SQLite con better-sqlite3, queries y transactions
│   └── index.ts     — MCP server con las tools
├── SYSTEM_PROMPT.md — System prompt para pegar en Claude Desktop
├── PENDING.md       — Features pendientes (embeddings, búsqueda en subsecciones)
├── CLAUDE.md        — Este archivo
└── dist/            — Build output (no editar)
```

El frontend Next.js está en una carpeta separada, no en este repo.

## BD — Schema

```sql
topic_groups     (id, name, created_at)
topics           (id, name, description, group_id→topic_groups, created_at)
topic_subsections(id, topic_id→topics, name, order_index)   ← canónicas, estables
recalls          (id, topic_id→topics, recalled_at, transcript, feedback, overall_score)
recall_subsections(id, recall_id→recalls, subsection_id→topic_subsections, covered INTEGER, score REAL)
```

**Distinción clave:**
- `topic_subsections` = las secciones canónicas del tema, definidas por la explicación de Claude. Relativamente estables.
- `recall_subsections` = resultado de cada sesión de recall. Una por cada recall × subsección.

La BD vive en `~/.recall-mcp/recall.db` (Windows: `C:\Users\<user>\.recall-mcp\recall.db`).

## Tools del MCP

| Tool | Cuándo se llama |
|---|---|
| `find_topic` | Antes de cualquier save, para detectar duplicados |
| `save_topic_subsections` | Después de generar la tabla de contenido, ANTES del recall |
| `save_recall` | Después de que el usuario hace el recall |
| `get_topic` | Para ver historial completo de un topic |
| `list_topics` | Lista todos los topics con última puntuación y fecha |
| `filter_topics` | Ordena por score, fecha o nombre |
| `update_subsection_name` | Corrige nombre de subsección si Claude se equivocó |

## Escala de calificación

**0.0 a 5.0** con decimales (escala colombiana). 3.0 = suficiente, 5.0 = perfecto.

## Decisiones de diseño importantes

**save_topic_subsections se llama ANTES del recall** — así la tabla de contenido queda persistida como verdad absoluta antes de que el usuario hable. Esto evita que Claude "contamine" la evaluación con lo que el usuario dijo.

**save_recall no crea subsecciones desde cero** — asume que ya existen (creadas por save_topic_subsections). Si por algún motivo no existen, las crea como fallback pero no es el flujo normal.

**La detección de duplicados la hace Claude, no el MCP** — find_topic hace búsqueda LIKE textual. Claude es quien decide si dos nombres distintos son el mismo concepto (ej: "producto punto" y "np.dot").

**Las subsecciones son por recall, no por topic** — recall_subsections guarda el resultado de cada sesión. Así se puede ver progreso por subsección a lo largo del tiempo.

## Flujo de recall completo

```
Claude explica algo sustancial
  → "Before we continue — want to do a recall on [topic]?"
  → Usuario dice sí
  → find_topic(nombre)          — detectar duplicados
  → "Any questions before we start?"
  → save_topic_subsections()    — persistir tabla de contenido
  → "Okay — what do you remember about [topic]?"
  → Usuario habla libremente
  → Claude evalúa contra tabla
  → feedback estructurado (✅ ⚠️ ❌ 🔴) + scores por subsección
  → save_recall()               — guardar todo
```

## Edge cases manejados en el system prompt

- **Hook suspendido**: si el usuario ignora el hook y sigue preguntando, Claude suspende y re-ofrece al próximo punto de pausa natural
- **Explicaciones densas** (5+ subsecciones): pregunta si quiere hacer recall de todo o de una parte
- **Multi-concepto**: si explicó GIL + join + I/O en un mensaje, pregunta cuáles quieren registrar — cada uno es un save_recall separado
- **Errores de Claude**: si se corrigió durante la conversación, la tabla usa solo la versión correcta
- **Cross-topic**: busca con múltiples queries (ej: "np.dot", "producto punto", "dot product") para detectar conceptos guardados con nombre distinto

## Pendientes (ver PENDING.md)

- Búsqueda semántica con embeddings
- Búsqueda en subsecciones (no solo en topic names)
- update_subsection_name ya implementada pero pendiente de exponer mejor en el frontend

## Comandos útiles

```bash
npm run build        # compilar TypeScript
npm start            # correr en producción
pm2 restart recall-dashboard  # reiniciar en producción

# Ver logs
pm2 logs recall-dashboard --lines 20
```

## Configuración Claude Desktop

El servidor se registra en `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "recall-mcp": {
      "command": "node",
      "args": ["C:\\ruta\\completa\\recall-mcp\\dist\\index.js"]
    }
  }
}
```

El system prompt va en Settings → Profile → Custom instructions (o en la config del Project si se usa Projects).