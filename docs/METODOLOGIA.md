# Metodología y funcionamiento del sistema Recall

Este documento explica cómo funciona el sistema por dentro: qué se guarda, qué se calcula, cómo se toman las decisiones de repaso y qué implica cada métrica.

---

## Flujo completo de una sesión de aprendizaje

```
Claude explica un tema
  → save_topic_subsections()   guarda la tabla de contenido (ground truth)
  → "¿qué recuerdas?"
  → el usuario responde libremente
  → Claude evalúa y da feedback
  → save_recall()              guarda transcript, feedback, scores
```

La tabla de contenido se guarda **antes** de que el usuario hable. Esto es deliberado: es la verdad de lo que se explicó, sin que el recall del usuario la contamine.

---

## Qué se guarda en cada sesión

### Recall completo (`save_recall`)
- **transcript**: lo que el usuario dijo, palabra por palabra.
- **feedback**: el desglose ✅ ⚠️ ❌ 🔴 que Claude mostró al usuario.
- **overall_score** (0.0–5.0): nota global de cobertura + calidad. Se penaliza si el usuario dijo algo incorrecto.
- **subsections**: por cada subsección del topic →
  - `covered` (boolean): ¿el usuario la mencionó?
  - `score` (0.0–5.0): qué tan bien la explicó.

### Quick review (`save_quick_review`)
- 3 preguntas cortas, una por subsección objetivo.
- Por cada pregunta: `question`, `answer`, `score`, `feedback`.
- Tiene `overall_score` propio que sí alimenta el `avg_score` del topic.
- Los scores por pregunta también alimentan el `avg_score` de sus subsecciones.

---

## Las métricas principales

> **`RECENT_WINDOW = 5`**: todas las métricas de score se calculan sobre las últimas 5 sesiones combinadas (recalls + quick reviews), no sobre el historial completo. Esto hace que las métricas reflejen el estado actual del conocimiento en lugar de acumularse indefinidamente.

### `avg_score` de un topic

El promedio de `overall_score` de las **últimas 5 sesiones** (recalls completos y quick reviews combinados, ordenados por fecha).

**Por qué no el historial completo:** un promedio histórico acumulado miente. Si fallabas un tema hace 6 meses y ahora lo dominas, el promedio histórico te seguiría marcando como débil. Las últimas 5 sesiones reflejan el estado actual.

### `avg_score` de una subsección

El promedio de `score` de las **últimas 5 sesiones** en que esa subsección fue evaluada (tanto en recalls completos como en quick reviews, ordenados por fecha).

### `times_missed` de una subsección

Cuántas veces, dentro de las **últimas 5 sesiones de recall completo**, el usuario no cubrió esa subsección (`covered = false`). Los quick reviews no contribuyen a `times_missed` porque no tienen concepto de "cubierto o no".

- `times_missed = 0`: la has cubierto en todos tus recalls recientes.
- `times_missed = 3`: en 3 de tus últimos 5 recalls, no la mencionaste.

### `urgency` de un topic

```
urgency = días_desde_último_recall_completo / (avg_score + 1) / log(total_recalls + e)
```

Tres factores:
- **Días desde el último recall completo**: a más tiempo sin repasar en profundidad, más urgencia. Los quick reviews **no** resetean este contador — no son repaso profundo.
- **avg_score**: a mayor score, menor urgencia.
- **Factor de consolidación** `log(total_recalls + e)`: a más recalls acumulados, el topic puede esperar más tiempo antes de volver a aparecer. `log(e) = 1` para topics nuevos (sin efecto), crece lentamente para no suprimir temas muy practicados para siempre.

Casos especiales:
- Topic sin ninguna sesión → `urgency = 999` (máxima prioridad).
- Topic con solo quick reviews y sin ningún recall completo → se usa la fecha del último quick review como fallback.

---

## Cómo se decide qué repasar (plan de repaso)

`get_review_plan` devuelve, por defecto, **4 slots** de propósito fijo. Cada slot usa un topic distinto.

> **Cantidad configurable (`review_slots`, 2–6, default 4).** Los 4 slots de propósito se construyen siempre y luego el servidor **recorta desde el final** (4→3 quita el recall completo, 3→2 quita la consolidación) o **extiende** con slots "quick urgentes" extra (5, 6) si hay candidatos. Es server-enforced: el modelo nunca decide cuántos. Se ajusta en `/settings`.
>
> **Ajuste automático (`review_slots_auto`, default false).** Cuando está activo, `review_slots` pasa a ser un **tope** y la sesión se dimensiona a cuántos topics están **vencidos** ese día (`days_overdue >= 0`, vía SM-2), acotado a `[REVIEW_SLOTS_MIN, review_slots]`. Días tranquilos → sesiones cortas; días con backlog → hasta el tope; y se acorta solo a medida que los intervalos se estiran con el dominio. No intenta cubrir *todos* los temas (eso pelearía con la repetición espaciada), solo los que tocan.

### Slot 1 — Más urgente
El topic con mayor `urgency`. Formato: **quick** (1 pregunta sobre la subsección con menor avg_score). Tiene cooldown: un topic que fue slot 1 en las últimas 2 sesiones no vuelve a serlo.

### Slot 2 — Fallo persistente
El topic más urgente (distinto al slot 1) que tenga al menos una subsección con `times_missed >= 2` **y** `avg_score < 4.0` en su ventana reciente. Formato: **recall dirigido** sobre las subsecciones más falladas.

Si no hay candidato, cae a un segundo topic urgente en formato quick.

### Slot 3 — Consolidación
Un topic que cumpla **los tres** criterios:
- `total_recalls >= 1` (ya practicado al menos una vez)
- `avg_score >= 3.5` (bien aprendido)
- `days_since_recall >= 7` (sin tocar al menos una semana)

Si no hay candidato, cae a un tercer topic urgente en formato quick.

### Slot 4 — Recall completo
El topic *conceptual* (con al menos 1 recall completo previo) con más días sin un recall completo. Formato: **recall completo** — recall libre de todo el topic, alimenta SM-2. Es el primero en recortarse si la sesión se acorta.

Si no hay candidato conceptual (p.ej. grupos 100% procedimentales como mate, donde los topics solo tienen quick reviews y `total_recalls = 0`), **cae a un quick urgente** — un recall completo no aplica a práctica procedimental.

### Dificultad adaptativa (`adaptive_difficulty`, default `true`)
Preferencia **blanda**: el servidor no la impone, la **expone** en `get_review_plan` (`settings.adaptive_difficulty` + `settings.difficulty_pace`) para que el tutor la honre. Cuando está activa, el tutor micro-ajusta el nivel de los ejercicios **dentro** de la sesión (escalera alrededor de `suggested_difficulty`) en vez de mantener un solo nivel; cuando está inactiva, mantiene `suggested_difficulty`. Relevante sobre todo para práctica procedimental (mate). La progresión **entre sesiones** (`suggestDifficulty`) siempre aplica y fija el nivel de arranque.

El **ritmo** (`difficulty_pace`: `suave`/`normal`/`exigente`, default `normal`) modula qué tan rápido escala esa escalera en vivo: `suave` sube tras 3 aciertos seguidos y baja ante cualquier tropiezo; `normal` sube tras 2 y baja con score <3; `exigente` sube con 1 acierto ≥4.5 y tolera más antes de bajar. Es también blando (lo interpreta el tutor); **no** altera la regla entre-sesiones de `suggestDifficulty`.

---

## Clasificación teórico/práctico

Cada subsección tiene un `kind`: **`teoria`** o **`practica`**. Es la **única fuente de verdad** de la naturaleza del contenido; el tipo del topic (`teorico` / `practico` / `teorico_practico`) **se deriva** de sus subsecciones, nunca se almacena:

- todas `teoria` → topic **teórico**
- todas `practica` → topic **práctico**
- mezcla → topic **teórico-práctico**

> **Por qué derivado y no almacenado.** Guardar el tipo del topic *y* el de cada subsección serían dos fuentes de verdad que se pueden desincronizar (reclasificas una subsección y el topic queda mintiendo). Derivar elimina esa clase de bug por construcción. El cálculo vive en `deriveTopicKind` (`lib/topic-kind.ts`), compartido por la lib de lectura (`db.ts`) y la de escritura (`db-mcp.ts`).

**Cómo se asigna:** `save_topic_subsections` acepta `kind` por subsección y un `default_kind` opcional para topics homogéneos (p.ej. mate = todo `practica`). El `default_kind` solo **inicializa subsecciones nuevas**; un `kind` explícito siempre gana, y reguardar la tabla de contenido nunca revierte una reclasificación hecha desde el dashboard. Desde el dashboard se cambia con un chip por subsección (`PATCH /api/subsections/[id]` con `{ kind }`).

**Cómo afecta el repaso:**
- En slots **quick**, el plan anota `target_subsection_kind`: `practica` → el tutor plantea un **ejercicio a resolver**; `teoria` → una **pregunta conceptual**.
- En el **scheduler SM-2** (selección de escalera y fuente), el `kind` derivado del topic decide qué cuenta como "repaso":
  - **Teórico** (o aún sin recalls completos): si hay recalls completos usa la escalera conceptual `[3, 14]` (reset 3); si solo hay quick reviews, la escalera densa `[1, 3, 7, 16]` (reset 1).
  - **Práctico**: escalera densa `[1, 3, 7, 16]` (reset 1) sobre los quick reviews.
  - **Teórico-práctico**: **fusiona** recalls completos *y* quick reviews en una sola línea temporal y aplica la escalera densa `[1, 3, 7, 16]` (reset 1). Esto corrige el bug donde, en cuanto existía un recall completo, los ejercicios dejaban de contar para la próxima fecha de repaso.

  La lógica vive en `smScheduleSource` (`lib/topic-kind.ts`), también compartida por ambas libs.

---

## Formatos de sesión

### Quick review
Una sola pregunta abierta sobre una subsección específica. No es "cuéntame sobre X" sino una pregunta que requiere razonamiento. Feedback breve (1–2 líneas) + score.

Se guarda con `save_quick_review`. Alimenta `avg_score` del topic y de subsecciones.

### Recall dirigido
Claude anuncia las subsecciones objetivo y espera. El usuario responde libremente. Se evalúan solo las subsecciones anunciadas.

Se guarda con `save_recall`. Alimenta `avg_score`, `times_missed`, y `total_recalls`.

### Recall completo
El flujo completo: tabla de contenido → "¿qué recuerdas?" → feedback exhaustivo. Se puede pedir en cualquier momento aunque no sea sesión de repaso formal.

---

## Gestión de subsecciones

`save_topic_subsections` es la única operación que define la estructura canónica de un topic. Cada vez que se llama:
- Añade las subsecciones nuevas con `order_index` correcto y su `kind` (explícito, o `default_kind`, o el default `teoria`).
- Actualiza el `order_index` de las existentes (por si la estructura cambió de orden).
- **No pisa el `kind` de subsecciones existentes** salvo que se pase un `kind` explícito para esa subsección: reguardar la TOC nunca revierte una reclasificación hecha desde el dashboard.
- Elimina subsecciones que ya no están en la lista **solo si no tienen historial de práctica**. Si tienen `recall_subsections` o `quick_review_answers`, se conservan para no perder el historial.

`save_recall` **no** crea subsecciones. Asume que `save_topic_subsections` ya fue llamado antes (como indica el system prompt).

---

## `avg_score` en getStats

El `avg_score` global del dashboard es el promedio del **último score de cada topic**, no el promedio de todos los recalls históricos. Esto refleja el estado actual de tu conocimiento por topic, no una media histórica distorsionada por sesiones antiguas.

---

## Estructura de datos (resumen)

```
topics
  └─ topic_subsections          (tabla de contenido canónica; cada una con kind teoria/practica)
       ├─ recall_subsections     (resultado por subsección en cada recall completo)
       └─ quick_review_answers   (respuesta por subsección en cada quick review)

recalls                         (sesiones de recall completo)
  └─ recall_subsections

quick_review_sessions           (sesiones de quick review)
  └─ quick_review_answers

topic_groups                    (Python, SO, Matemáticas...)
```

`recall_subsections` y `quick_review_answers` vinculan evaluaciones de subsección con su sesión padre a través de `recall_id` / `session_id`. Esto permite ordenar por fecha sin necesitar un timestamp propio en cada fila.
