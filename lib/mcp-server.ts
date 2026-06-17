import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  findTopics,
  getTopicByName,
  getTopicHistory,
  listTopics,
  filterTopics,
  getReviewCandidates,
  getReviewPlan,
  getStats,
  saveTopicSubsections,
  saveRecall,
  saveQuickReview,
  updateSubsectionName,
  updateRecallFeedback,
  updateTopic,
  deleteRecall,
  mergeTopics,
  deleteTopic,
} from "./db-mcp";

export function createMcpServer(userId: number): McpServer {
  const server = new McpServer({ name: "recall-mcp", version: "2.0.0" });

  // ─── find_topic ─────────────────────────────────────────────────────────────

  server.tool(
    "find_topic",
    "Busca topics existentes por nombre o por nombre de subsección (búsqueda parcial). Devuelve match_type: 'topic' | 'subsection' | 'both' y matched_subsections cuando el match es por subsección. Usar ANTES de save_recall para detectar duplicados.",
    { query: z.string().describe("Texto a buscar en el nombre del topic o de sus subsecciones") },
    async ({ query }) => {
      const results = await findTopics(query, userId);
      return { content: [{ type: "text", text: JSON.stringify({ found: results.length, topics: results }, null, 2) }] };
    },
  );

  // ─── get_topic ──────────────────────────────────────────────────────────────

  server.tool(
    "get_topic",
    "Devuelve el historial completo de un topic: subsecciones canónicas y todos sus recalls.",
    { topic_name: z.string().describe("Nombre exacto del topic") },
    async ({ topic_name }) => {
      const topic = await getTopicByName(topic_name, userId);
      if (!topic) {
        return { content: [{ type: "text", text: JSON.stringify({ found: false, message: `No se encontró "${topic_name}"` }, null, 2) }] };
      }
      const history = await getTopicHistory(topic.id, userId);
      return { content: [{ type: "text", text: JSON.stringify({ found: true, topic: history }, null, 2) }] };
    },
  );

  // ─── list_topics ────────────────────────────────────────────────────────────

  server.tool(
    "list_topics",
    "Lista todos los topics con su última puntuación, fecha de recall y total de recalls.",
    { group_name: z.string().optional().describe("Filtrar por grupo. Si se omite, devuelve todos.") },
    async ({ group_name }) => {
      const topics = await listTopics(userId, group_name);
      return { content: [{ type: "text", text: JSON.stringify({ total: topics.length, topics }, null, 2) }] };
    },
  );

  // ─── filter_topics ──────────────────────────────────────────────────────────

  server.tool(
    "filter_topics",
    "Filtra y ordena topics por criterio.",
    {
      sort_by: z.enum(["score_asc", "score_desc", "date_asc", "date_desc", "name"]).describe(
        "score_asc: puntuación más baja primero | score_desc: más alta | date_asc: sin repasar hace más tiempo | date_desc: más recientes | name: alfabético",
      ),
      group_name: z.string().optional().describe("Filtrar por grupo."),
    },
    async ({ sort_by, group_name }) => {
      const topics = await filterTopics(userId, sort_by, group_name);
      return { content: [{ type: "text", text: JSON.stringify({ total: topics.length, sort_by, topics }, null, 2) }] };
    },
  );

  // ─── get_review_candidates ──────────────────────────────────────────────────

  server.tool(
    "get_review_candidates",
    "Devuelve todos los topics ordenados por urgencia (urgencia = días_sin_repasar / (avg_score + 1)). Usar para exploración. Para sesiones de repaso usar get_review_plan.",
    { group_name: z.string().optional().describe("Filtrar por grupo. Si se omite, todos.") },
    async ({ group_name }) => {
      const candidates = await getReviewCandidates(userId, group_name);
      return { content: [{ type: "text", text: JSON.stringify({ total: candidates.length, candidates }, null, 2) }] };
    },
  );

  // ─── get_review_plan ────────────────────────────────────────────────────────

  server.tool(
    "get_review_plan",
    "Genera el plan de la sesión de repaso: slots con topic, formato (quick / recall_dirigido / recall_completo) y subsecciones objetivo ya calculados. Llamar al inicio de cada sesión de repaso. Cada slot trae `kind` (teorico/practico/teorico_practico) y, en slots quick, `target_subsection_kind`: si es 'practica' plantea un EJERCICIO a resolver, si es 'teoria' una pregunta conceptual. Cada slot trae también `suggested_difficulty` (1-5, ya calculado del historial de scores) y `last_difficulty` (la última usada): para subsecciones prácticas, plantea los ejercicios a la dificultad sugerida — no la estimes — y pásala a save_quick_review. El campo `new_topics` lista temas que el usuario aún no ha estrenado (0 sesiones) y que por preferencia NO entran al repaso espaciado: no los incluyas en la sesión salvo que el usuario pida explícitamente estrenarlos; puedes mencionarlos al final como temas pendientes por practicar.",
    { group_name: z.string().optional().describe("Filtrar por grupo. Si se omite, todos.") },
    async ({ group_name }) => {
      const plan = await getReviewPlan(userId, group_name);
      return { content: [{ type: "text", text: JSON.stringify(plan, null, 2) }] };
    },
  );

  // ─── get_stats ──────────────────────────────────────────────────────────────

  server.tool(
    "get_stats",
    "Devuelve un resumen global del progreso: total de topics, recalls, promedio de score, topics bajo 3.0, topics nunca repasados, racha de días y grupo más activo.",
    {},
    async () => {
      const stats = await getStats(userId);
      return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
    },
  );

  // ─── save_topic_subsections ─────────────────────────────────────────────────

  server.tool(
    "save_topic_subsections",
    "Guarda el topic y sus subsecciones canónicas ANTES de pedir el recall al usuario. Clasifica cada subsección como 'teoria' (se entiende/explica, se evalúa con recall conceptual) o 'practica' (se resuelve con ejercicios). El tipo del TEMA se deriva: solo teoría → teórico, solo práctica → práctico, ambos → teórico-práctico. Usa default_kind para temas homogéneos (mate = todo 'practica') y kind por subsección para temas mixtos (programación, física).",
    {
      topic_name: z.string().describe("Nombre del topic"),
      group_name: z.string().optional().describe("Grupo (ej: 'Python'). Opcional."),
      default_kind: z.enum(["teoria", "practica"]).optional().describe("Tipo por defecto para subsecciones NUEVAS sin kind propio. No reclasifica las existentes."),
      subsections: z.array(z.union([
        z.string(),
        z.object({
          name: z.string(),
          kind: z.enum(["teoria", "practica"]).optional().describe("'teoria' = conceptual; 'practica' = ejercicios. Omitir para heredar default_kind."),
        }),
      ])).describe("Subsecciones en orden. Cada una un string (hereda default_kind) o un objeto {name, kind}."),
    },
    async ({ topic_name, group_name, default_kind, subsections }) => {
      try {
        // Normaliza la forma string|objeto a {name, kind?} para la capa de DB.
        const normalized = subsections.map((s) => (typeof s === "string" ? { name: s } : s));
        const result = await saveTopicSubsections({ topic_name, group_name, default_kind, subsections: normalized }, userId);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Topic "${topic_name}" listo para recall`, ...result }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ success: false, error: String(err) }) }], isError: true };
      }
    },
  );

  // ─── save_recall ────────────────────────────────────────────────────────────

  server.tool(
    "save_recall",
    "Guarda un recall de un topic. Crea el topic, grupo y subsecciones si no existen.",
    {
      topic_name:    z.string().describe("Nombre del topic"),
      group_name:    z.string().optional().describe("Grupo. Opcional."),
      transcript:    z.string().optional().describe("Texto literal del recall del usuario"),
      feedback:      z.string().optional().describe("Retroalimentación de la IA"),
      overall_score: z.number().min(0).max(5).describe("Puntuación global (0.0–5.0)"),
      format:        z.enum(["completo", "dirigido"]).optional().describe("Tipo de recall: 'completo' = recall libre de todo el topic (default, alimenta SM-2). 'dirigido' = solo subsecciones débiles, NO avanza el intervalo SM-2."),
      session_id:    z.number().int().optional().describe("ID de la sesión de repaso devuelto por get_review_plan. Pasar siempre en sesiones de repaso para trazabilidad."),
      subsections: z.array(z.object({
        name:    z.string(),
        covered: z.boolean(),
        score:   z.number().min(0).max(5),
      })).describe("Lista de subsecciones evaluadas"),
    },
    async (input) => {
      try {
        const result = await saveRecall(input, userId);
        const topic = await getTopicByName(input.topic_name, userId);
        const history = topic ? await getTopicHistory(topic.id, userId) : null;
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Recall guardado para "${input.topic_name}"`,
              recall_id: result.recall_id,
              topic_id: result.topic_id,
              total_recalls_for_topic: history?.recalls.length ?? 1,
              overall_score: input.overall_score,
            }, null, 2),
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ success: false, error: String(err) }) }], isError: true };
      }
    },
  );

  // ─── save_quick_review ──────────────────────────────────────────────────────

  server.tool(
    "save_quick_review",
    "Guarda una sesión de quick review: preguntas curadas con sus respuestas y scores. IMPORTANTE: pasá la dificultad usada en el param `difficulty` (1-5) — NO la escribas en el feedback como texto.",
    {
      topic_name:    z.string().describe("Nombre exacto del topic"),
      overall_score: z.number().min(0).max(5).describe("Score global (0.0–5.0)"),
      feedback:      z.string().optional().describe("Resumen general de la sesión (opcional)"),
      session_id:    z.number().int().optional().describe("ID de la sesión de repaso devuelto por get_review_plan. Pasar siempre en sesiones de repaso para trazabilidad."),
      difficulty:    z.number().int().min(1).max(5).optional().describe("Dificultad (1-5) a la que se plantearon los ejercicios en esta sesión. Usar la que indicó get_review_plan (suggested_difficulty), ajustada si tuviste que subir/bajar en vivo. Alimenta la dificultad sugerida de la próxima sesión."),
      answers: z.array(z.object({
        subsection_name: z.string(),
        question:        z.string(),
        answer:          z.string(),
        score:           z.number().min(0).max(5),
        feedback:        z.string().optional().describe("Feedback inline para esta respuesta"),
      })).describe("Preguntas, respuestas, scores y feedback por respuesta"),
    },
    async (input) => {
      const result = await saveQuickReview(input, userId);
      if (!result.success) {
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: true };
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Quick review guardado para "${input.topic_name}"`,
            session_id: result.session_id,
            topic_id: result.topic_id,
            overall_score: input.overall_score,
            difficulty: result.difficulty,
          }, null, 2),
        }],
      };
    },
  );

  // ─── update_subsection_name ─────────────────────────────────────────────────

  server.tool(
    "update_subsection_name",
    "Corrige el nombre de una subsección canónica.",
    {
      topic_name: z.string(),
      old_name:   z.string(),
      new_name:   z.string(),
    },
    async ({ topic_name, old_name, new_name }) => {
      const result = await updateSubsectionName(topic_name, old_name, new_name, userId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: !result.success };
    },
  );

  // ─── update_recall_feedback ─────────────────────────────────────────────────

  server.tool(
    "update_recall_feedback",
    "Actualiza el feedback de un recall existente.",
    {
      recall_id: z.number().int().describe("ID del recall"),
      feedback:  z.string().describe("Texto completo del feedback"),
    },
    async ({ recall_id, feedback }) => {
      const result = await updateRecallFeedback(recall_id, feedback, userId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: !result.success };
    },
  );

  // ─── update_topic ───────────────────────────────────────────────────────────

  server.tool(
    "update_topic",
    "Renombra un topic y/o lo mueve a otro grupo.",
    {
      topic_name: z.string(),
      new_name:   z.string().optional(),
      group_name: z.string().nullable().optional().describe("Nuevo grupo. null para quitar el grupo."),
    },
    async ({ topic_name, new_name, group_name }) => {
      const result = await updateTopic(topic_name, { new_name, group_name }, userId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: !result.success };
    },
  );

  // ─── delete_recall ──────────────────────────────────────────────────────────

  server.tool(
    "delete_recall",
    "Borra una sesión de recall específica por ID.",
    { recall_id: z.number().int() },
    async ({ recall_id }) => {
      const result = await deleteRecall(recall_id, userId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: !result.success };
    },
  );

  // ─── merge_topics ───────────────────────────────────────────────────────────

  server.tool(
    "merge_topics",
    "Fusiona dos topics en uno: mueve todos los recalls del topic origen al destino y lo elimina.",
    {
      source_topic: z.string().describe("Topic a eliminar"),
      target_topic: z.string().describe("Topic que absorbe al origen"),
    },
    async ({ source_topic, target_topic }) => {
      const result = await mergeTopics(source_topic, target_topic, userId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: !result.success };
    },
  );

  // ─── delete_topic ───────────────────────────────────────────────────────────

  server.tool(
    "delete_topic",
    "Borra un topic y TODO su historial. Acción irreversible.",
    { topic_name: z.string() },
    async ({ topic_name }) => {
      const result = await deleteTopic(topic_name, userId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: !result.success };
    },
  );

  return server;
}
