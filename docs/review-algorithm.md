# Algoritmo de sesiones de repaso

Referencia rápida sobre cómo el sistema elige topics y subsecciones para cada sesión.

---

## Cuándo una subsección deja de ser "débil"

Una subsección tiene dos umbrales distintos dependiendo del slot:

### Umbral fuerte: `mastered` (se excluye de todos los pools débiles)

```
mastered = true  si  allEntries >= 5
                 AND avg_score  >= 4.5
                 AND times_missed == 0
```

- `allEntries`: las últimas 5 sesiones que tocaron esa subsección, mezclando recalls completos y quick reviews, ordenadas por fecha.
- `times_missed`: cuántos de los últimos 5 *recalls* tuvieron `covered = false`. Los quick reviews no cuentan porque no tienen concepto de "cubrió o no".
- Una subsección `mastered` desaparece del ranking de débiles y no vuelve a ser objetivo hasta que regrese a `false` (si en una sesión futura la score baja o se pierde de nuevo).

### Umbral suave: excluida del slot 2 (`recall_dirigido`)

```
excluida del slot 2  si  avg_score >= 4.0
```

Más permisivo que `mastered`: no requiere 5 sesiones ni 4.5 de score. Sirve para no desperdiciar el slot 2 en subsecciones que ya van bien aunque no estén completamente consolidadas. No tiene condición sobre `times_missed` porque un miss aislado con score alto no indica fallo persistente.

---

## Cómo se elige el topic para cada slot

### Paso previo: ranking de candidatos

Todos los topics se ordenan por `days_overdue` descendente antes de repartir slots.

```
days_overdue = hoy − next_review_date
```

`next_review_date` viene del algoritmo SM-2 aplicado solo a `recall_completo` (los `recall_dirigido` no avanzan el intervalo). Cuanto más positivo el valor, más urgente el topic.

### Slot 1 — más urgente

- Primero candidato con `days_overdue` más alto que **no** estuvo en slot 1 en ninguna de las últimas 2 sesiones (cooldown).
- Si todos están en cooldown, se toma el más urgente sin restricción (fallback).
- Formato: `quick` (una pregunta sobre la subsección objetivo).

### Slot 2 — fallo persistente

- Primer topic (que no sea el del slot 1) donde alguna subsección tiene `times_missed >= 2` **y** `avg_score < 4.0`.
- Formato: `recall_dirigido` (se anuncian 2-3 subsecciones, el usuario recuerda libremente sobre ellas).
- Si ningún topic cumple la condición, **fallback**: el siguiente más urgente en el ranking, formato `quick`.

### Slot 3 — consolidación

- Primer topic no usado con `total_recalls >= 3`, `avg_score >= 3.5`, y `days_since_recall >= 7`.
- Intención: reforzar topics que van bien antes de que se olviden.
- Formato: `quick`.
- Si ninguno cumple, **fallback**: el siguiente más urgente, formato `quick`.

### Slot 4 — recall completo

- Del pool de topics no usados con al menos 1 recall previo, se toma el que lleva más días sin un `recall_completo` (`days_since_full_recall` máximo; `null` = nunca → máxima prioridad).
- Formato: `recall_completo` (libre, sin guía de subsecciones). Es el único slot que avanza SM-2.

---

## Cómo se elige la subsección objetivo dentro del topic

### Para slots quick (1, 2-fallback, 3, 3-fallback)

1. Filtra las subsecciones no `mastered`.
2. Las ordena por `avg_score` ascendente (la más débil primero).
3. Toma las **3 más débiles** (bottom-3).
4. De esas 3, elige la que sea **distinta a la última subsección preguntada** para ese topic (rotación).
5. Si todas son iguales o solo hay una, se toma la primera de igual forma.

Esto evita que siempre se pregunte sobre la misma subsección aunque sea la peor.

### Para slot 2 (`recall_dirigido`)

Toma hasta 3 subsecciones ordenadas por:
1. `times_missed` descendente (las más esquivadas primero).
2. `avg_score` ascendente como desempate.

Excluye las que tienen `avg_score >= 4.0 AND times_missed == 0` (umbral suave).

---

## Tabla resumen

| Slot | Propósito | Formato | Topic elegido | Subsección elegida |
|------|-----------|---------|---------------|--------------------|
| 1 | Más urgente | quick | Mayor `days_overdue` (con cooldown 2 sesiones) | Bottom-3 rotando |
| 2 | Fallo persistente | recall_dirigido | Alguna sub con `missed >= 2` y `score < 4` | Top-3 más fallidas |
| 2 | (fallback) | quick | Siguiente en ranking | Bottom-3 rotando |
| 3 | Consolidación | quick | `recalls >= 3`, `score >= 3.5`, `días >= 7` | Bottom-3 rotando |
| 3 | (fallback) | quick | Siguiente en ranking | Bottom-3 rotando |
| 4 | Recall completo | recall_completo | Mayor `days_since_full_recall` | — (topic entero) |

---

## Constantes relevantes en el código

| Constante | Valor | Dónde |
|-----------|-------|-------|
| `RECENT_WINDOW` | 5 | Ventana de sesiones para `avg_score` y `times_missed` |
| `SLOT1_COOLDOWN_SESSIONS` | 2 | Sesiones que un topic queda bloqueado de slot 1 |
| Umbral `mastered` | `score >= 4.5`, `missed == 0`, `entries >= 5` | `getReviewCandidates` |
| Umbral suave slot 2 | `score >= 4.0` | `weakestRecallSubsections` |
