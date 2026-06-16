# Tutor de matemática (modo práctico) — decisión de arquitectura

Adaptación del sistema de recall para práctica diaria de matemática de secundaria
(grados 6-11). Caso de uso inicial: una sola estudiante; objetivo a futuro: multiusuario.

## Decisiones tomadas

1. **Evolucionar el proyecto, no clonarlo.** Una sola codebase. MCP + Supabase +
   Next.js es base suficiente.
2. **Granularidad: cada subtema = un topic propio; la materia = el grupo.**
   - Descartado "SM-2 a nivel de subsección": exigía reescribir `getReviewCandidates`
     y `getReviewPlan` (el código más frágil del repo, con 5 fixes de bugs) para
     obtener el mismo comportamiento.
   - Con subtema=topic el motor SM-2 funciona **sin cambios**: ya agenda por topic.
   - Costo aceptado: el dashboard mostrará ~44 topics en el grupo `matematica`
     (se limpiará después agrupando por materia). Los campos prácticos cuelgan del
     topic, no de una subsección.
3. **Scoring objetivo, no estimado.** El score de una sesión de ejercicios es
   correctos/total mapeado a 0-5. Es el salto pedagógico central y no requiere
   cambios de esquema.
4. **Multiusuario más adelante**, vía token por usuario → `user_id` (no Supabase
   Auth todavía). Diseñar el esquema sin pintarse en una esquina, sin construir
   auth ni currículo formal aún.

## Orden de ejecución

1. **Validar la pedagogía con casi cero código:** cargar la tabla de contenido
   como ~44 topics en el grupo `matematica` + `SYSTEM_PROMPT_MATE.md`. Reutiliza
   SM-2 intacto. Una semana de uso real decide si el método sirve.
2. Si sirve → cambios de esquema acotados (ver abajo) + multiusuario por token.
3. Currículo formal como entidad solo al apuntar a "todo el mundo".

## Estructura de datos (fase 1, sin cambios de esquema)

- Cada subtema es un `topic` (ej. "Factorización") con `group = "matematica"`.
  SM-2 agenda a este nivel — motor intacto.
- **Las subsecciones del topic son los tipos de caso / casos borde** del subtema,
  no una dummy. El motor ya rastrea `avg_score`, `times_missed`, rotación
  (`weakestQuickSubsection`) y `mastered` **por subsección** → cobertura
  sistemática de casos y priorización de los flojos, sin tocar código.
- Enfoque **mixto**:
  - Subtemas **con casos** (Factorización, Productos notables, Ecuaciones,
    Funciones, Áreas/Volumen, etc.) → subsecciones = lista de tipos de caso.
  - Subtemas **atómicos** (Jerarquía de operaciones, MCM/MCD, Dato/Población/
    Muestra) → subsección única `general`. No se inventan casos donde no hay
    habilidades distintas (evita ruido en el agendamiento).
  - La lista de casos por subtema la propone Claude (currículo estándar 6-11) y
    la **valida la mamá como docente**.
- `mastered` por subsección = señal de "domina *todos* los casos del subtema" —
  crítico porque ella va a enseñar secundaria, no le basta con los casos fáciles.
- La **dificultad es un dato** (`quick_review_sessions.difficulty`, 1-5): cada
  sesión guarda el nivel realmente usado y `getReviewPlan` devuelve por slot
  `last_difficulty` + `suggested_difficulty` (calculada server-side). Antes era
  texto libre en el feedback y el modelo no la reconstruía bien (siempre media);
  ver "Dificultad estructurada" abajo. Los **errores recurrentes** sí siguen en
  el texto de feedback (Claude los lee con `get_topic`).

## No cubierto en fase 1 (honesto)

- **Interleaving profundo** (mezclar ejercicios de varios subtemas en un bloque):
  hoy solo hay interleaving a nivel sesión (4 subtemas/día). Modo nuevo, fase 2.
- **Prerrequisitos implícitos** (factorización ⇐ productos notables): no hay grafo
  de dependencias. El prompt lo maneja blando (detectar y sugerir repasar el
  prerrequisito). Solución estructural = currículo formal, aplazado.

## Cambios de esquema propuestos (fase 2 — pendientes de aprobación)

Acotados, casi todo cuelga del topic:

| Campo | Tabla | Para qué |
|---|---|---|
| ~~`current_difficulty` (1-5)~~ | ~~`topics`~~ | ✅ Implementado distinto: `difficulty` por sesión (ver abajo) |
| `common_errors` (texto) | `topics` | Errores recurrentes; priorizar el subtipo |
| `exercises_total` / `exercises_correct` | `quick_review_sessions` | Score objetivo trazable |
| `difficulty` del intento | `quick_review_answers` | Curva de progresión |
| `user_id` | `topics`, `topic_groups` | ✅ Implementado (multiusuario) |

Cambio de lógica también pendiente: que las sesiones de ejercicios
(`quick_review`) alimenten el intervalo SM-2 (hoy solo lo hace `format:"completo"`).

**SM-2 alimentado por quick reviews (IMPLEMENTADO).** En `getReviewCandidates`
(db-mcp.ts) y `getTopics` (db.ts): si el topic no tiene recalls `completo`, SM-2
se calcula desde los `quick_review_sessions`. Escalera según tipo de práctica:
- Conceptual (con recalls completos, ej. Emily): `[3, 14]` luego `×EF`,
  reinicio 3 — **sin cambios**, cero regresión.
- Procedimental (solo quick reviews, ej. Lesty): escalera densa
  `[1, 3, 7, 16]` luego `×EF`, reinicio 1 si falla (<3). Elegida por la docente.
Sin esto, un topic de solo quick-review nunca avanzaba intervalo y el
agendamiento era pura recencia (sin repetición espaciada real).

## Dificultad estructurada (IMPLEMENTADO)

**Problema:** la dificultad vivía como texto (`Dificultad: N/5`) en el feedback;
el modelo debía escribirla, releerla con `get_topic` y parsearla. La cadena se
rompía y siempre caía al default (media). Además un score sin la dificultad a la
que se logró es ambiguo.

**Solución** (migración `2026-06-15_quick-review-difficulty.sql`):
- Columna `quick_review_sessions.difficulty` (smallint 1-5, nullable). Cada
  `save_quick_review` guarda el nivel realmente usado (param `difficulty`).
- `getReviewCandidates`/`getReviewPlan` calculan y devuelven por slot
  `last_difficulty` (última usada, null si nunca) y `suggested_difficulty` (a qué
  nivel plantear ahora). El modelo ya no estima: obedece el plan.
- Regla de progresión (server-side, función `suggestDifficulty` en `db-mcp.ts` —
  único lugar que decide; ajustar umbrales ahí): sin historial → 2; última <3 →
  baja 1; las dos últimas ≥4 → sube 1; si no, mantiene. Clamp 1-5. Son las
  reglas que la docente ya había fijado en el prompt, ahora ejecutadas por código.
- Sesiones viejas (difficulty NULL) se tratan como "sin nivel previo" → arrancan
  en 2 y la escalera se reconstruye desde la próxima sesión.

Pendiente opcional: mostrar la dificultad en el dashboard (trayectoria por
subtema). El motor y el prompt ya la usan.

## Tabla de contenido a cargar (grupo `matematica`)

- **Aritmética**: Jerarquía de operaciones · MCM y MCD · Fracciones simples y
  combinadas con signos de agrupación · Porcentajes · Razones y proporciones ·
  Regla de tres simple y compuesta · Decimales y conversión · Potenciación
- **Álgebra**: Lenguaje algebraico · Valor numérico · Términos semejantes ·
  Multiplicación y división de expresiones algebraicas · Productos notables ·
  Factorización · Ecuaciones de primer grado con fracciones · Sistemas de
  ecuaciones (sustitución, eliminación, igualación) · Inecuaciones · Funciones
  (lineal, cuadrática, exponencial, logarítmica, dominio y rango) · Progresiones
  aritméticas y geométricas · Logaritmos y ecuaciones logarítmicas
- **Trigonometría**: Razones trigonométricas · Ángulos notables (30°, 45°, 60°) ·
  Hallar lados con trigonometría · Hallar ángulos con arcsen/arccos/arctan ·
  Ángulos de elevación y depresión · Ley de senos · Ley de cosenos
- **Geometría**: Clasificación de ángulos · Ángulos complementarios y
  suplementarios · Tipos de rectas · Triángulos (clasificación por lados y
  ángulos) · Teorema de Pitágoras · Perímetro y área de figuras planas · Círculo ·
  Cuerpos geométricos · Volumen
- **Estadística**: Dato · Población · Muestra · Frecuencia · Medidas de tendencia
  (media, moda, mediana) · Gráficas estadísticas (barras, circular, grados)

## Clasificación atómico / con-casos (PARA VALIDAR — borrador de Claude)

`A` = atómico (subsección única `general`). `C` = con casos (subsecciones = tipos).

### Aritmética
- `A` Jerarquía de operaciones · `A` MCM y MCD · `A` Decimales y conversión
- `C` Fracciones: suma/resta igual denominador · suma/resta distinto denominador ·
  multiplicación · división · combinadas con signos de agrupación · complejas
- `C` Porcentajes: de una cantidad · cantidad dado el % · variación (aumento/
  descuento) · porcentaje sucesivo
- `C` Razones y proporciones: razón · proporción · cuarta proporcional · reparto
  proporcional (directo/inverso)
- `C` Regla de tres: simple directa · simple inversa · compuesta
- `C` Potenciación: exponente entero · exponente negativo · leyes de potencias ·
  notación científica · radicación básica

### Álgebra
- `A` Lenguaje algebraico · `A` Valor numérico · `A` Términos semejantes
- `C` Mult./div. de expresiones: monomio×monomio · monomio×polinomio ·
  polinomio×polinomio · división de polinomios
- `C` Productos notables: binomio al cuadrado · suma por diferencia · binomio al
  cubo · trinomio al cuadrado
- `C` Factorización: factor común · agrupación · diferencia de cuadrados ·
  trinomio cuadrado perfecto · trinomio x²+bx+c · trinomio ax²+bx+c · cubos
- `C` Ecuaciones primer grado con fracciones: sin paréntesis · con paréntesis ·
  con fracciones · con denominadores algebraicos
- `C` Sistemas de ecuaciones: sustitución · eliminación · igualación
- `C` Inecuaciones: primer grado · con fracciones · doble · representación
- `C` Funciones: lineal · cuadrática · exponencial · logarítmica · dominio y rango
- `C` Progresiones: aritmética (término / suma) · geométrica (término / suma)
- `C` Logaritmos: definición/cálculo · propiedades · ecuaciones logarítmicas

### Trigonometría
- `A` Razones trigonométricas · `A` Ángulos notables (30/45/60)
- `C` Hallar lados: con seno · con coseno · con tangente
- `C` Hallar ángulos: arcsen · arccos · arctan
- `A` Ángulos de elevación y depresión · `A` Ley de senos · `A` Ley de cosenos

### Geometría
- `C` Clasificación de ángulos: por medida · por posición (adyacentes, opuestos)
- `A` Ángulos complementarios y suplementarios · `A` Tipos de rectas
- `C` Triángulos: por lados · por ángulos
- `A` Teorema de Pitágoras
- `C` Perímetro y área: triángulo · cuadrilátero · polígono regular · círculo ·
  figuras compuestas
- `A` Círculo (longitud y área)
- `C` Cuerpos geométricos: prisma · cilindro · pirámide · cono · esfera
- `C` Volumen: prisma/cubo · cilindro · pirámide · cono · esfera

### Estadística
- `A` Dato · `A` Población · `A` Muestra · `A` Frecuencia
- `C` Medidas de tendencia: media · moda · mediana (datos agrupados / no agrupados)
- `C` Gráficas: barras · circular (torta + grados)
