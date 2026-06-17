// Progresión de dificultad para práctica procedimental (mate). Función pura,
// sin DB, para que la compartan la capa MCP (db-mcp.ts, service-role) y la de
// lectura del dashboard (db.ts, sesión RLS) — un único lugar que decide la regla.

export const clampDifficulty = (n: number) => Math.max(1, Math.min(5, Math.round(n)));

// Fallback para cuando el modelo NO manda el param `difficulty` en save_quick_review
// y en su lugar lo escribe como texto en el feedback (su mal hábito recurrente, p.ej.
// "Dificultad: 3/5" o "Dif. 4"). Rescata ese número (1-5) para no perder el dato.
// Devuelve null si no encuentra un patrón claro. Toma la primera coincidencia.
export function parseDifficultyFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/\b(?:dificultad|dif\.?)\s*:?\s*([1-5])(?:\s*\/\s*5)?\b/i);
  return m ? Number(m[1]) : null;
}

// Sugiere la dificultad (1-5) para la *próxima* quick review de un topic, según
// las reglas de la docente (originalmente prosa en SYSTEM_PROMPT_MATE):
//   - sin historial            → 2 (básico-medio)
//   - última sesión score <3    → baja un nivel (vuelve a lo básico)
//   - las dos últimas score ≥4  → sube un nivel (ya mecanizó, exígele más)
//   - resto                     → se mantiene en la última dificultad usada
// `sessions` = quick reviews del topic, MÁS RECIENTE PRIMERO. `difficulty` es null
// para sesiones guardadas antes de trackearla (se trata como "sin nivel previo").
// Ajustar umbrales aquí cambia el comportamiento en todo el sistema.
export function suggestDifficulty(
  sessions: { score: number; difficulty: number | null }[],
): { last: number | null; suggested: number } {
  const last = sessions.find((s) => s.difficulty != null)?.difficulty ?? null;
  if (sessions.length === 0) return { last: null, suggested: 2 };
  const base = last ?? 2;
  const [s0, s1] = sessions;
  if (s0.score < 3) return { last, suggested: clampDifficulty(base - 1) };
  if (s1 && s0.score >= 4 && s1.score >= 4) return { last, suggested: clampDifficulty(base + 1) };
  return { last, suggested: clampDifficulty(base) };
}
