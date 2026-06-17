-- Clasificación teórico / práctico por subsección.
--
-- El sistema ya tenía dos motores de práctica (recall conceptual y quick review
-- procedimental), pero el "tipo" se INFERÍA de los datos: un tema con recalls se
-- trataba como conceptual, uno con solo quick reviews como procedimental. Eso se
-- rompe en temas teórico-prácticos (programación, física, química): en cuanto
-- reciben UN recall completo, el agendado SM-2 deja de contar los ejercicios.
--
-- Ahora el tipo es un dato explícito a nivel de subsección (el grano en que el
-- sistema ya opera: avg_score, times_missed, targeting). El tipo del TEMA se
-- DERIVA (lib/topic-kind.ts): solo teoría → teórico, solo práctica → práctico,
-- ambos → teórico-práctico. No se almacena en `topics` para no tener dos fuentes
-- de verdad que se desincronicen.
--
-- ADITIVA Y REVERSIBLE. Columna NOT NULL con default 'teoria' (el comportamiento
-- histórico era recall-first). Rollback:
--   alter table public.topic_subsections drop column kind;
--
-- Correr una sola vez en el SQL editor de Supabase (o psql).

alter table public.topic_subsections
  add column if not exists kind text not null default 'teoria'
  check (kind in ('teoria', 'practica'));

-- Backfill: las subsecciones de temas que HOY solo tienen práctica procedimental
-- (≥1 quick review y 0 recalls completos, p.ej. los temas de mate) pasan a
-- 'practica'. Esto reproduce exactamente la inferencia implícita previa, así que
-- el agendado SM-2 de esos temas no cambia. El resto queda en 'teoria' (default).
update public.topic_subsections ts
set kind = 'practica'
where exists (
        select 1 from public.quick_review_sessions q where q.topic_id = ts.topic_id
      )
  and not exists (
        select 1 from public.recalls r where r.topic_id = ts.topic_id
      );
