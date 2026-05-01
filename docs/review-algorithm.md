# Algoritmo de sesiones de repaso

Referencia sobre cómo el sistema elige topics y subsecciones para cada sesión, y qué hace Claude en cada slot.

---

## Qué hace cada slot

Una sesión de repaso tiene siempre 4 slots. Cada uno tiene un propósito distinto.

### Slot 1 — pregunta rápida sobre el topic más urgente

**Formato:** `quick`

Claude hace una sola pregunta abierta y pedagógica sobre la subsección objetivo del topic más urgente. No es "cuéntame sobre X" sino "¿por qué X causa Y?" o "¿qué diferencia hay entre X y Z?".

- Si el topic tiene `recent_questions` para esa subsección, Claude elige un ángulo distinto al de las últimas 5 preguntas.
- El usuario responde; Claude da feedback inline de 1-2 líneas y un score (0.0–5.0).
- Se guarda con `save_quick_review`.

### Slot 2 — ataque a las subsecciones más problemáticas

**Formato normal:** `recall_dirigido`  
**Formato fallback:** `quick`

Se activa cuando hay un topic con subsecciones que se han fallado repetidamente (`times_missed >= 2` y `avg_score < 4.0`). Claude anuncia las subsecciones objetivo y pide al usuario que recuerde libremente sobre ellas:

> "Cuéntame lo que recuerdas sobre [A] y [B] de [topic]."

El usuario responde sin ayuda. Claude evalúa solo esas subsecciones y da feedback breve por cada una. Se guarda con `save_recall` y `format: "dirigido"` — **no avanza SM-2**.

Si no hay ningún topic con fallos persistentes, el slot cae a fallback: una quick question sobre el siguiente topic más urgente.

### Slot 3 — mantenimiento de lo bien aprendido

**Formato normal:** `quick`  
**Formato fallback:** `quick`

Busca un topic con buen historial (`recalls >= 1`, `avg_score >= 3.5`) que no se ha tocado en al menos 7 días. La intención es reforzarlo antes de que empiece a olvidarse, aunque todavía no esté en zona roja de urgencia.

Misma mecánica que slot 1: una pregunta, feedback breve, score. Se guarda con `save_quick_review`.

Si no hay ningún topic consolidado que cumpla el criterio, fallback al siguiente más urgente.

### Slot 4 — recall completo

**Formato:** `recall_completo`

El topic que lleva más tiempo sin un recall libre completo. Claude dice:

> "Okay — cuéntame todo lo que recuerdas sobre [topic]."

El usuario habla sin límites ni guías. Claude evalúa contra todas las subsecciones del topic, da feedback estructurado (✅ ⚠️ ❌ 🔴), score por subsección y score global. Se guarda con `save_recall` y `format: "completo"` — **este es el único slot que avanza SM-2**.

No hay "¿alguna pregunta antes de empezar?" — el slot 4 es rápido, sin ritos previos.

---

## Cuándo una subsección deja de ser "débil"

Una subsección tiene dos umbrales distintos dependiendo del slot:

### Umbral fuerte: `mastered` (se excluye de todos los pools)

```
mastered = true  si  allEntries >= 5
                 AND avg_score  >= 4.5
                 AND times_missed == 0
```

- `allEntries`: las últimas 5 sesiones que tocaron esa subsección, mezclando recalls y quick reviews, ordenadas por fecha.
- `times_missed`: cuántos de los últimos 5 *recalls* tuvieron `covered = false`. Los quick reviews no tienen concepto de "cubierto o no".
- Una subsección `mastered` desaparece de todos los rankings de débiles. Si en sesiones futuras la score baja o se vuelve a fallar, `mastered` regresa a `false`.

### Umbral suave: excluida del slot 2 (`recall_dirigido`)

```
excluida del slot 2  si  avg_score >= 4.0
```

Más permisivo que `mastered`: no requiere 5 sesiones ni score tan alto. Sirve para no incluir en el slot dirigido subsecciones que ya van razonablemente bien. No tiene condición sobre `times_missed` porque un miss aislado con score alto no es fallo persistente.

---

## Cómo se elige el topic para cada slot

### Paso previo: ranking de candidatos

Todos los topics se ordenan por `days_overdue` descendente antes de repartir slots.

```
days_overdue = hoy − next_review_date
```

`next_review_date` viene del algoritmo SM-2 aplicado **solo** a `recall_completo`. Cuanto más positivo el valor, más urgente.

### Slot 1 — más urgente

- El candidato con `days_overdue` más alto que **no** estuvo en slot 1 en ninguna de las últimas 2 sesiones (cooldown).
- Si todos están en cooldown, se toma el más urgente sin restricción (fallback).

### Slot 2 — fallo persistente

- El primer topic no usado donde alguna subsección tiene `times_missed >= 2` y `avg_score < 4.0`.
- `times_missed` es la cuenta de recalls con `covered = false` dentro de la ventana `RECENT_WINDOW` (últimos 5 recalls). Quick reviews no cuentan.
- Si ninguno cumple, fallback al siguiente más urgente en el ranking.

### Slot 3 — consolidación

- El primer topic no usado con `total_recalls >= 1`, `avg_score >= 3.5` y `days_since_recall >= 7`.
- Si ninguno cumple, fallback al siguiente más urgente.

### Slot 4 — recall completo

- Del pool de topics no usados con al menos 1 recall previo, el que tiene mayor `days_since_full_recall`. `null` (nunca hubo recall completo) tiene prioridad máxima.

---

## Cómo se elige la subsección objetivo dentro del topic

### Para slots quick (1, 2-fallback, 3, 3-fallback)

1. Filtra subsecciones no `mastered`.
2. Ordena por `avg_score` ascendente.
3. Toma las **3 más débiles** (bottom-3).
4. De esas 3, elige la **distinta a la última subsección preguntada** para ese topic (rotación).
5. Si solo hay una o todas son iguales, se toma la primera.

### Para slot 2 (`recall_dirigido`)

Toma hasta 3 subsecciones ordenadas por:
1. `times_missed` descendente — cuántos de los últimos 5 recalls tuvieron `covered = false` (las más esquivadas primero).
2. `avg_score` ascendente como desempate.

Excluye las que tienen `avg_score >= 4.0` (umbral suave).

---

## Tabla resumen

| Slot | Propósito | Formato | Topic elegido | Subsección elegida | Avanza SM-2 |
|------|-----------|---------|---------------|--------------------|-------------|
| 1 | Más urgente | quick | Mayor `days_overdue` (cooldown 2 sesiones) | Bottom-3 rotando | No |
| 2 | Fallo persistente | recall_dirigido | Sub con `missed >= 2` y `score < 4` | Top-3 más fallidas | No |
| 2 | (fallback) | quick | Siguiente en ranking | Bottom-3 rotando | No |
| 3 | Consolidación | quick | `recalls >= 1`, `score >= 3.5`, `días >= 7` | Bottom-3 rotando | No |
| 3 | (fallback) | quick | Siguiente en ranking | Bottom-3 rotando | No |
| 4 | Recall completo | recall_completo | Mayor `days_since_full_recall` | — (topic entero) | **Sí** |

---

## Constantes relevantes en el código

| Constante | Valor | Efecto |
|-----------|-------|--------|
| `RECENT_WINDOW` | 5 | Ventana de sesiones para `avg_score` y `times_missed` |
| `SLOT1_COOLDOWN_SESSIONS` | 2 | Sesiones que un topic queda bloqueado de slot 1 |
| Umbral `mastered` | `score >= 4.5`, `missed == 0`, `entries >= 5` | Excluye de todos los pools |
| Umbral suave slot 2 | `score >= 4.0` | Excluye del pool de `recall_dirigido` |
