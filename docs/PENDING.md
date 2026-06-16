# Pendientes

## Vista global de historial (dashboard)
- Página `/history` que muestre todos los recalls de todos los topics en orden cronológico
- Tipo "qué estudié el 12 de abril" — línea de tiempo global
- Cada entrada: topic, score, fecha, link al detalle

## get_review_queue
- Devuelve los topics que "toca repasar" según score y días desde el último recall
- La lógica de intervalos (cuántos días esperar según score) la define Emily
- Ordenar por urgencia (más atrasado / peor score primero)
- Base para spaced repetition proactivo desde Claude Desktop

## get_stats
- Resumen global: total topics, promedio de scores, topics con score < 3, racha de días
- Para que Claude pueda dar un panorama sin leer topic por topic

## Búsqueda semántica con embeddings
- Reemplazar `find_topic` por búsqueda semántica para detectar topics relacionados aunque tengan nombres distintos (ej: "np.dot" → "Producto punto")
- Requiere modelo de embeddings local o via API

## Búsqueda en subsecciones
- `search_topics` debería buscar también en `topic_subsections.name`, no solo en `topics.name`
- Si encuentra match en subsección, devolver `match_type: "subsection"` con el topic padre
- Relacionado con embeddings — mejor implementar ambos juntos

## save_topic_subsections (tool separada)
- Separar el guardado en dos pasos:
  1. `save_topic_subsections` — antes del recall, guarda topic + subsecciones canónicas
  2. `save_recall` — después, guarda transcript + scores
- Así la tabla de contenido queda persistida antes de que el usuario hable

## update_subsection_name
- Tool para corregir nombres de subsecciones cuando Claude se equivocó en una sesión anterior
- Útil para el caso de N² → N³ cache misses
