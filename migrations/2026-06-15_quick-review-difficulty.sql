-- Tutor de mate — dificultad estructurada por sesión de quick review.
--
-- Hasta ahora la dificultad vivía como texto libre ("Dificultad: N/5") en el
-- feedback de la sesión, y el modelo tenía que reconstruirla parseando ese texto.
-- En la práctica fallaba y siempre usaba dificultad media. Ahora es un dato:
-- cada quick review guarda la dificultad realmente usada (1-5), y el motor
-- (`getReviewPlan`) devuelve por slot `last_difficulty` + `suggested_difficulty`.
--
-- ADITIVA Y REVERSIBLE. Columna nullable: las sesiones viejas quedan en NULL
-- (= "sin dificultad registrada"), y suggested_difficulty arranca en 2 para ellas.
-- Rollback: alter table public.quick_review_sessions drop column difficulty;

alter table public.quick_review_sessions
  add column if not exists difficulty smallint
  check (difficulty is null or difficulty between 1 and 5);
