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

`get_review_plan` devuelve 3 slots. Cada slot usa un topic distinto.

### Slot 1 — Más urgente
El topic con mayor `urgency`. Formato: **quick** (1 pregunta sobre la subsección con menor avg_score).

### Slot 2 — Fallo persistente
El topic más urgente (distinto al slot 1) que tenga al menos una subsección con `times_missed >= 2` en su ventana reciente. Formato: **recall dirigido** sobre las subsecciones más falladas.

Si no hay candidato con `times_missed >= 2`, cae a un segundo topic urgente en formato quick.

### Slot 3 — Consolidación
Un topic que cumpla **los tres** criterios:
- `total_recalls >= 3` (genuinamente practicado, no visto una sola vez)
- `avg_score >= 3.5` (bien aprendido)
- `days_since_recall >= 7` (sin tocar al menos una semana)

Si no hay candidato, cae a un tercer topic urgente en formato quick.

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
- Añade las subsecciones nuevas con `order_index` correcto.
- Actualiza el `order_index` de las existentes (por si la estructura cambió de orden).
- Elimina subsecciones que ya no están en la lista **solo si no tienen historial de práctica**. Si tienen `recall_subsections` o `quick_review_answers`, se conservan para no perder el historial.

`save_recall` **no** crea subsecciones. Asume que `save_topic_subsections` ya fue llamado antes (como indica el system prompt).

---

## `avg_score` en getStats

El `avg_score` global del dashboard es el promedio del **último score de cada topic**, no el promedio de todos los recalls históricos. Esto refleja el estado actual de tu conocimiento por topic, no una media histórica distorsionada por sesiones antiguas.

---

## Estructura de datos (resumen)

```
topics
  └─ topic_subsections          (tabla de contenido canónica)
       ├─ recall_subsections     (resultado por subsección en cada recall completo)
       └─ quick_review_answers   (respuesta por subsección en cada quick review)

recalls                         (sesiones de recall completo)
  └─ recall_subsections

quick_review_sessions           (sesiones de quick review)
  └─ quick_review_answers

topic_groups                    (Python, SO, Matemáticas...)
```

`recall_subsections` y `quick_review_answers` vinculan evaluaciones de subsección con su sesión padre a través de `recall_id` / `session_id`. Esto permite ordenar por fecha sin necesitar un timestamp propio en cada fila.
