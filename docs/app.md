# Recall MCP — documentación de la aplicación

Sistema de active recall personal. Claude Desktop explica temas, el usuario hace recall libre, y el sistema registra el progreso a lo largo del tiempo usando espaciado (SM-2).

---

## Arquitectura

```
Claude Desktop ──HTTP──▶ Vercel (/api/mcp) ──▶ Supabase ◀── Dashboard (Next.js)
```

| Componente | Ubicación | Responsabilidad |
|---|---|---|
| MCP server HTTP | `pages/api/mcp.ts` | Endpoint que recibe llamadas de Claude Desktop |
| Definición de tools | `lib/mcp-server.ts` | Registra los tools MCP con sus schemas Zod |
| Lógica de escritura | `lib/db-mcp.ts` | Queries a Supabase (save_recall, get_review_plan, etc.) |
| Lógica de lectura | `lib/db.ts` | Queries para el dashboard (solo lectura) |
| Dashboard | `app/page.tsx`, `app/topics/[id]/page.tsx` | Visualización del progreso |
| System prompt | `SYSTEM_PROMPT.md` | Instrucciones para Claude Desktop sobre cómo usar los tools |

---

## Modelo de datos

```
topic_groups
  └── topics
        ├── topic_subsections
        │     ├── recall_subsections  (score por subsección en cada recall)
        │     └── quick_review_answers (pregunta/respuesta en cada QR)
        ├── recalls
        └── quick_review_sessions
              └── quick_review_answers

review_sessions
  └── review_session_slots  (qué topics/subsecciones se eligieron en cada sesión)
```

### Tablas principales

**`topics`** — un registro por tema aprendido.
- `name`, `group_id` (FK → `topic_groups`), `description`, `created_at`

**`topic_subsections`** — las secciones canónicas de un topic, guardadas antes del recall.
- `topic_id`, `name`, `order_index`

**`recalls`** — cada sesión de recall libre.
- `topic_id`, `recalled_at`, `transcript`, `feedback`, `overall_score`
- `format`: `"completo"` (avanza SM-2) o `"dirigido"` (no avanza SM-2)
- `review_session_id` (FK → `review_sessions`, null si fue recall espontáneo fuera de sesión)

**`recall_subsections`** — resultado por subsección dentro de un recall.
- `recall_id`, `subsection_id`, `covered` (bool), `score`

**`quick_review_sessions`** — sesiones de quick review (preguntas curadas).
- `topic_id`, `reviewed_at`, `overall_score`, `feedback`, `review_session_id` (FK → `review_sessions`)

**`quick_review_answers`** — cada pregunta/respuesta dentro de un QR.
- `session_id`, `subsection_id`, `question`, `answer`, `score`, `feedback`

**`review_sessions`** — trazabilidad: un registro por cada llamada a `get_review_plan`.
- `started_at`, `group_name`

**`review_session_slots`** — los 4 slots de cada sesión de repaso.
- `session_id`, `slot_number` (1–4), `topic_id`, `format`, `subsection_names[]`

---

## Flujo de recall normal

Se usa cuando Claude explica un tema nuevo o el usuario pide hacer recall.

```
1. Claude explica el tema
2. Claude llama save_topic_subsections()
   → persiste la tabla de contenido ANTES de pedir el recall
3. Claude: "¿qué recuerdas sobre [topic]?"
4. Usuario responde libremente
5. Claude evalúa y da feedback (✅ ⚠️ ❌ 🔴)
6. Claude llama save_recall()
   → guarda transcript, feedback, scores por subsección
7. Si hay gaps (❌ o ⚠️), Claude los cierra con preguntas dirigidas
```

El `format` del recall guardado es siempre `"completo"` en este flujo — avanza SM-2.

---

## Flujo de sesión de repaso

Se activa cuando el usuario dice "quiero repasar" o similar.

```
1. Claude llama get_review_plan()
   → recibe 4 slots calculados + session_id
   → la sesión queda registrada en review_sessions / review_session_slots
2. Claude ejecuta los slots en orden (ver review-algorithm.md)
3. Al terminar, Claude guarda resultados — siempre con el `session_id` devuelto por `get_review_plan`:
   - Slots quick      → save_quick_review() con session_id
   - Slot dirigido    → save_recall() con format: "dirigido" + session_id
   - Slot completo    → save_recall() con format: "completo" + session_id
4. Claude da resumen de la sesión (2-4 líneas)
```

Ver [review-algorithm.md](./review-algorithm.md) para el detalle de cómo se eligen topics y subsecciones.

---

## SM-2 (espaciado de intervalos)

El algoritmo SM-2 calcula cuándo revisar cada topic próximamente.

**Solo los `recall_completo` avanzan SM-2.** Los `recall_dirigido` y quick reviews no cuentan porque no evidencian retención completa del topic.

```
Rep 0  → intervalo 3 días
Rep 1  → intervalo 14 días
Rep 2+ → intervalo = round(intervalo_anterior × EF)

EF (ease factor) empieza en 2.5, mín 1.3
EF_nuevo = EF + 0.1 − (5 − score) × (0.08 + (5 − score) × 0.02)
```

`next_review_date = fecha_último_recall_completo + intervalo`  
`days_overdue = hoy − next_review_date`  (negativo = aún no toca, positivo = atrasado)

---

## Zonas horarias

El dashboard corre como funciones serverless en Vercel, cuyo proceso usa `TZ=UTC`.
Por eso **todo cálculo de "qué día es" debe hacerse en la zona del usuario, no en la
del servidor**. La zona se guarda por usuario en `users.settings.timezone` (jsonb) y
se **auto-detecta** del navegador en la primera visita autenticada
(`components/timezone-sync.tsx` → `PATCH /api/settings`). Hasta entonces aplica
`DEFAULT_TIMEZONE` (`lib/dates.ts`); el MCP, que no tiene navegador, también usa ese
default si la zona aún no se capturó.

Helpers en `lib/dates.ts` (puros, sirven en servidor y cliente):

| Helper | Para qué |
|---|---|
| `dayInTz(instant, tz)` | Día calendario `YYYY-MM-DD` de un instante visto en `tz` (vía `Intl`, robusto a horario de verano) |
| `addDays(day, delta)` | Avanza/retrocede un string `YYYY-MM-DD` en días (aritmética en UTC) |
| `timeInTz(instant, tz)` | Hora `HH:MM` en `tz`; el servidor y el cliente formatean igual → sin *hydration mismatch* |
| `formatDayLabel(day)` | Etiqueta humana ("lunes, 16 de junio de 2026") de un día ya resuelto |

Puntos que dependen de la zona (todos arreglados para usar la del usuario): racha de
días (`getStudyStreak`, `get_stats`), `days_overdue` / "hoy" de SM-2, y la agrupación
+ encabezados de día en `/history` y `/sessions`. **Antes** se usaba
`new Date().getDate()` / `iso.slice(0,10)`, que en el servidor daba la fecha UTC → una
sesión de la noche caía en el día siguiente y la racha se rompía cerca de medianoche.

---

## MCP tools

| Tool | Cuándo se llama |
|---|---|
| `find_topic` | Antes de cualquier save, para detectar duplicados |
| `get_topic` | Para ver historial completo de un topic |
| `list_topics` | Listar todos los topics con último score y fecha |
| `filter_topics` | Ordenar topics por score, fecha o nombre |
| `get_stats` | Resumen global: totals, avg score, racha, topics bajo 3.0 |
| `get_review_plan` | Al inicio de una sesión de repaso — devuelve 4 slots |
| `get_review_candidates` | Exploración: lista topics por urgencia (no usar para sesiones) |
| `save_topic_subsections` | Inmediatamente después de construir la tabla de contenido, antes del recall |
| `save_recall` | Después de que el usuario termina un recall (completo o dirigido) |
| `save_quick_review` | Después de completar todos los slots quick de una sesión |
| `update_subsection_name` | Corregir nombre de subsección guardado mal |
| `update_recall_feedback` | Corregir o ampliar feedback de un recall existente |
| `update_topic` | Renombrar un topic o cambiarle de grupo |
| `delete_recall` | Borrar una sesión de recall específica por ID |
| `merge_topics` | Fusionar dos topics — mueve todos los recalls del origen al destino |
| `delete_topic` | Borrar un topic y todo su historial (irreversible) |

---

## Grupos de topics

Los topics pueden agruparse para filtrar sesiones de repaso por materia.

Grupos inferidos automáticamente por Claude según el contenido:
- `"Python"` — temas de Python
- `"Sistemas Operativos"` — OS, threads, scheduling, memoria
- `"Matemáticas"` — álgebra lineal, cálculo, etc.
- `"Redes"` — networking, protocolos
- Sin grupo si el tema no encaja claramente en ninguno

---

## Dashboard

Rutas disponibles:

| Ruta | Contenido |
|---|---|
| `/` | Lista de todos los topics con score, fecha, tendencia y días hasta próxima revisión |
| `/topics/[id]` | Detalle: subsecciones, historial de recalls con breakdown por subsección |
| `/sessions` | Sesiones de repaso agrupadas por día, con los 4 slots y scores por slot |
| `/history` | Historial cronológico de todas las sesiones (recalls y quick reviews) |

El dashboard solo lee de Supabase — nunca escribe.

### Sistema visual

El dashboard usa un lenguaje visual coherente ("redondeado y cálido"):

- **Marca**: logo "Recall" (bucle circular ↺ con punto, gradiente magenta) en
  `components/logo.tsx` (`LogoMark` + `Logo`); el favicon vive en `app/icon.svg`
  (convención de App Router). El header de `/` usa `<Logo />`.
- **Radio**: un único token raíz `--radius: 0.625rem` en `globals.css`; Tailwind v4
  deriva `--radius-sm/md/lg` vía `calc()`, así que todos los `rounded-*` cascadean
  desde ahí. **No** hardcodear radios fijos (`rounded` a secas) — usar las
  utilidades del token (`rounded-md`, `rounded-sm`, `rounded-lg`).
- **Feedback in-app** (no `alert()`/`confirm()` nativos):
  - **Toasts** con `sonner` → `components/ui/sonner.tsx` (`<Toaster />`, tema
    sincronizado a `next-themes`). Para errores: `toast.error(msg)`.
  - **Confirmaciones** con `components/confirm-dialog.tsx`: `<ConfirmProvider>`
    (montado en `app/layout.tsx`) + hook `useConfirm()` promise-based sobre Radix
    AlertDialog. Patrón en el call site: `if (!(await confirm({ title, … }))) return`.
- **Idioma**: toda la UI visible está en español (los términos de dominio
  "recall"/"quick review"→"repaso rápido" y los préstamos "feedback"/"email" se
  mantienen).

### Columna "Próxima"

Muestra cuándo toca el próximo `recall_completo` según SM-2.

| Indicador | Color | Significado |
|---|---|---|
| `—` | gris | Nunca se ha hecho un `recall_completo` — SM-2 no ha arrancado |
| `en Nd` | gris | Faltan N días para la próxima revisión — no toca aún |
| `hoy` | amarillo | La fecha de revisión es hoy |
| `+Nd` | **rojo** | Atrasado N días y tiene ≥ 2 recalls completos (intervalo SM-2 fiable) |
| `+Nd` | gris tenue | Atrasado según SM-2 pero solo tiene 1 recall completo — el primer intervalo es siempre 3 días, no es significativo todavía |

El umbral para considerar el intervalo SM-2 "fiable" es `total_recalls >= 2`. Con un solo recall el intervalo es fijo en 3 días para todos los topics, lo que genera demasiado ruido visual.

---

## Configuración

### Claude Desktop

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

### Variables de entorno (Vercel)

| Variable | Uso |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave anon de Supabase |
| `MCP_API_KEY` | Bearer token que usa Claude Desktop para autenticarse |
| `DASHBOARD_USER` | Usuario para Basic Auth del dashboard |
| `DASHBOARD_PASS` | Contraseña para Basic Auth del dashboard |

### Comandos

```bash
# Desde la raíz del monorepo
npm install              # instala todo
npm run dev:dashboard    # dev server en puerto 3000
npm run start:dashboard  # producción en 0.0.0.0

# Deploy manual
cd packages/dashboard
vercel deploy --prod
```
