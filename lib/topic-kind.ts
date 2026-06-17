// Clasificación teórico / práctico y la regla de agendado SM-2 que de ella se
// deriva. Módulo PURO (sin DB), igual que ./difficulty, para que lo compartan la
// capa MCP (db-mcp.ts, service-role) y la de lectura del dashboard (db.ts, sesión
// RLS). Antes la selección de fuente SM-2 estaba DUPLICADA a mano en ambos
// archivos ("mirrors lib/db-mcp.ts"); centralizarla acá evita que se desincronicen.

// Tipo de una subsección. Es la ÚNICA fuente de verdad de la clasificación.
export type SubsectionKind = "teoria" | "practica";

// Tipo del tema. NO se almacena: se DERIVA de los kinds de sus subsecciones
// (deriveTopicKind). Un tema con subsecciones de ambos tipos es teórico-práctico.
export type TopicKind = "teorico" | "practico" | "teorico_practico";

export const SUBSECTION_KINDS: readonly SubsectionKind[] = ["teoria", "practica"];

export function isSubsectionKind(v: unknown): v is SubsectionKind {
  return v === "teoria" || v === "practica";
}

// Deriva el tipo del tema a partir de los kinds de sus subsecciones.
//   solo 'teoria'              → 'teorico'
//   solo 'practica'            → 'practico'
//   ambos                      → 'teorico_practico'
//   sin subsecciones (vacío)   → 'teorico' (default histórico: recall-first)
export function deriveTopicKind(kinds: SubsectionKind[]): TopicKind {
  const hasTheory = kinds.includes("teoria");
  const hasPractice = kinds.includes("practica");
  if (hasTheory && hasPractice) return "teorico_practico";
  if (hasPractice) return "practico";
  return "teorico";
}

// ─── Agendado SM-2: selección de fuente + escalera de intervalos ───────────────

// Una "sesión" que alimenta SM-2: fecha (ISO) + calidad q (overall_score 0-5).
export interface SmEntry {
  date: string;
  q: number;
}

export interface SmSchedule {
  // Fuente ordenada ascendente por fecha (el bucle SM-2 la recorre cronológica).
  source: SmEntry[];
  // Escalera de intervalos (días) para las primeras reps; luego ×EF.
  ladder: number[];
  // Intervalo (días) al que se resetea tras un fallo (q < 3).
  failReset: number;
}

const byDate = (a: SmEntry, b: SmEntry) => a.date.localeCompare(b.date);

// Decide qué sesiones alimentan SM-2 y con qué escalera, según el tipo del tema.
//
//  - 'teorico'  : conceptual. Si hay recalls completos, esos mandan (escalera
//                 espaciada [3,14], reset 3). Sin recalls aún, cae a quick reviews
//                 con la escalera densa — comportamiento histórico preservado.
//  - 'practico' : procedimental (mate). Alimentado por quick reviews, escalera
//                 densa [1,3,7,16] (masa temprana, se estira al mecanizar), reset 1.
//  - 'teorico_practico': TU DECISIÓN — ver TODO abajo.
export function smScheduleSource(
  kind: TopicKind,
  fullRecalls: SmEntry[], // recalls con format 'completo'
  quickReviews: SmEntry[],
): SmSchedule {
  // Teórico-práctico: el tema se practica de DOS formas (recall conceptual +
  // ejercicios) y AMBAS alimentan el agendado. Mezclamos las dos fuentes ordenadas
  // por fecha — así se arregla el bug de que un recall completo "apagaba" los
  // ejercicios. Escalera densa [1,3,7,16] reset 1: un tema mixto se toca seguido
  // por ambas vías, así que repasos frecuentes al inicio que se estiran al dominar.
  if (kind === "teorico_practico") {
    const source = [...fullRecalls, ...quickReviews].sort(byDate);
    return { source, ladder: [1, 3, 7, 16], failReset: 1 };
  }

  // 'teorico' y 'practico': inferencia por presencia de recalls (comportamiento
  // histórico, sin regresiones).
  const useRecalls = fullRecalls.length > 0;
  const source = (useRecalls ? fullRecalls : quickReviews).slice().sort(byDate);
  return {
    source,
    ladder: useRecalls ? [3, 14] : [1, 3, 7, 16],
    failReset: useRecalls ? 3 : 1,
  };
}
