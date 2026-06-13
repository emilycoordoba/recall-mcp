-- Track C — topics ↔ grupos muchos-a-muchos (gestionado solo desde el dashboard).
--
-- No destructiva: `topics.group_id` se conserva como el grupo "primario" (lo que
-- siguen usando las tools MCP, el plan de repaso, stats y las queries de lista).
-- `topic_group_links` es la fuente de verdad del conjunto COMPLETO de grupos de un
-- topic, que el dashboard muestra y edita. El primario también vive aquí (backfill).

create table if not exists public.topic_group_links (
  topic_id   bigint      not null references public.topics(id)       on delete cascade,
  group_id   bigint      not null references public.topic_groups(id) on delete cascade,
  user_id    bigint      not null references public.users(id)        on delete cascade,
  created_at timestamptz not null default now(),
  primary key (topic_id, group_id)
);

create index if not exists topic_group_links_group_idx on public.topic_group_links(group_id);
create index if not exists topic_group_links_user_idx  on public.topic_group_links(user_id);

-- Backfill desde la asignación 1-a-1 existente.
insert into public.topic_group_links (topic_id, group_id, user_id)
select id, group_id, user_id
from public.topics
where group_id is not null
on conflict do nothing;
