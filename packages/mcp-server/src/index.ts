import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import db, {
  saveRecall,
  saveTopicSubsections,
  saveQuickReview,
  updateRecallFeedback,
  updateSubsectionName,
  updateTopic,
  deleteRecall,
  mergeTopics,
  deleteTopic,
  getReviewCandidates,
  getTopicByName,
  getTopicHistory,
  findTopics,
  listTopics,
  filterTopics,
} from "./db.js";

const server = new McpServer({
  name: "recall-mcp",
  version: "1.0.0",
});

// ─── Tool: save_recall ────────────────────────────────────────────────────────

server.tool(
  "save_recall",
  "Guarda un recall de un topic. Crea el topic, grupo y subsecciones si no existen. " +
  "Si el topic ya existe, agrega el recall al historial.",
  {
    topic_name:    z.string().describe("Nombre del topic (ej: 'For loops en Python')"),
    group_name:    z.string().optional().describe("Grupo al que pertenece (ej: 'Python'). Opcional."),
    transcript:    z.string().optional().describe("Texto literal de lo que dijo el usuario en el recall"),
    feedback:      z.string().optional().describe("Retroalimentación generada por la IA"),
    overall_score: z.number().min(0).max(5).describe("Puntuación global del recall (0.0–5.0)"),
    subsections: z.array(
      z.object({
        name:    z.string().describe("Nombre de la subsección"),
        covered: z.boolean().describe("¿El usuario la cubrió en su recall?"),
        score:   z.number().min(0).max(5).describe("Puntuación de esta subsección (0.0–5.0)"),
      })
    ).describe("Lista de subsecciones evaluadas"),
  },
  async (input) => {
    try {
      const result = saveRecall(input);
      const topic = getTopicByName(input.topic_name)!;
      const history = getTopicHistory(topic.id)!;
      const totalRecalls = history.recalls.length;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Recall guardado para "${input.topic_name}"`,
            recall_id: "recall_id" in result ? result.recall_id : null,
            topic_id: result.topic_id,
            total_recalls_for_topic: totalRecalls,
            overall_score: input.overall_score,
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: false, error: String(err) }, null, 2),
        }],
        isError: true,
      };
    }
  }
);

// ─── Tool: find_topic ─────────────────────────────────────────────────────────

server.tool(
  "find_topic",
  "Busca topics existentes por nombre (búsqueda parcial). " +
  "Usar ANTES de save_recall para detectar duplicados o topics relacionados.",
  {
    query: z.string().describe("Texto a buscar en el nombre del topic"),
  },
  async ({ query }) => {
    const results = findTopics(query);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          found: results.length,
          topics: results,
        }, null, 2),
      }],
    };
  }
);

// ─── Tool: get_topic ──────────────────────────────────────────────────────────

server.tool(
  "get_topic",
  "Devuelve el historial completo de un topic: subsecciones canónicas y todos sus recalls con detalle.",
  {
    topic_name: z.string().describe("Nombre exacto del topic"),
  },
  async ({ topic_name }) => {
    const topic = getTopicByName(topic_name);
    if (!topic) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ found: false, message: `No se encontró el topic "${topic_name}"` }, null, 2),
        }],
      };
    }

    const history = getTopicHistory(topic.id);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ found: true, topic: history }, null, 2),
      }],
    };
  }
);

// ─── Tool: list_topics ────────────────────────────────────────────────────────

server.tool(
  "list_topics",
  "Lista todos los topics con su última puntuación, fecha de recall y total de recalls.",
  {
    group_name: z.string().optional().describe("Filtrar por grupo. Si se omite, devuelve todos."),
  },
  async ({ group_name }) => {
    const topics = listTopics(group_name);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ total: topics.length, topics }, null, 2),
      }],
    };
  }
);

// ─── Tool: filter_topics ─────────────────────────────────────────────────────

server.tool(
  "filter_topics",
  "Filtra y ordena topics por criterio. Útil para identificar qué topics necesitan más repaso.",
  {
    sort_by: z
      .enum(["score_asc", "score_desc", "date_asc", "date_desc", "name"])
      .describe(
        "Criterio de ordenamiento:\n" +
        "- score_asc: puntuación más baja primero (los que más necesitas repasar)\n" +
        "- score_desc: puntuación más alta primero\n" +
        "- date_asc: los que no repasas hace más tiempo primero\n" +
        "- date_desc: los más recientemente repasados primero\n" +
        "- name: alfabético"
      ),
    group_name: z.string().optional().describe("Filtrar por grupo. Si se omite, todos los grupos."),
  },
  async ({ sort_by, group_name }) => {
    const topics = filterTopics(sort_by, group_name);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ total: topics.length, sort_by, topics }, null, 2),
      }],
    };
  }
);

// ─── Tool: save_topic_subsections ────────────────────────────────────────────

server.tool(
  "save_topic_subsections",
  "Guarda el topic y sus subsecciones canónicas ANTES de pedir el recall al usuario. " +
  "Llamar justo después de generar la tabla de contenido, antes de decir 'what do you remember?'",
  {
    topic_name:  z.string().describe("Nombre del topic"),
    group_name:  z.string().optional().describe("Grupo (ej: 'Python'). Opcional."),
    subsections: z.array(z.string()).describe("Lista de nombres de subsecciones en orden"),
  },
  async (input) => {
    try {
      const result = saveTopicSubsections(input);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Topic "${input.topic_name}" listo para recall`,
            topic_id: result.topic_id,
            subsections: result.subsections,
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, error: String(err) }) }],
        isError: true,
      };
    }
  }
);

// ─── Tool: update_subsection_name ─────────────────────────────────────────────

server.tool(
  "update_subsection_name",
  "Corrige el nombre de una subsección canónica. Útil cuando Claude se equivocó en una explicación anterior (ej: dijo N² pero era N³).",
  {
    topic_name: z.string().describe("Nombre exacto del topic"),
    old_name:   z.string().describe("Nombre incorrecto de la subsección"),
    new_name:   z.string().describe("Nombre correcto"),
  },
  async ({ topic_name, old_name, new_name }) => {
    const result = updateSubsectionName(topic_name, old_name, new_name);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: !result.success,
    };
  }
);

// ─── Tool: save_quick_review ─────────────────────────────────────────────────

server.tool(
  "save_quick_review",
  "Guarda una sesión de quick review: 3 preguntas curadas con sus respuestas y scores. " +
  "Distinto a save_recall — no requiere transcript libre ni tabla de contenido previa. " +
  "Actualiza la urgencia del topic para spaced repetition.",
  {
    topic_name:    z.string().describe("Nombre exacto del topic"),
    overall_score: z.number().min(0).max(5).describe("Score global de la sesión (0.0–5.0)"),
    answers: z.array(z.object({
      subsection_name: z.string().describe("Nombre de la subsección a la que apunta la pregunta"),
      question:        z.string().describe("Pregunta exacta que se hizo"),
      answer:          z.string().describe("Respuesta del usuario"),
      score:           z.number().min(0).max(5).describe("Score de esta respuesta (0.0–5.0)"),
    })).describe("Lista de preguntas, respuestas y scores"),
  },
  async (input) => {
    const result = saveQuickReview(input);
    if (!result.success) {
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: true,
      };
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
        }, null, 2),
      }],
    };
  }
);

// ─── Tool: get_review_candidates ─────────────────────────────────────────────

server.tool(
  "get_review_candidates",
  "Devuelve todos los topics ordenados por urgencia de repaso (urgencia = días_sin_repasar / (avg_score + 1)). " +
  "Topics sin recall aparecen primero con urgencia 999. " +
  "Usar para elegir los 3 más urgentes y generar preguntas curadas de repaso.",
  {
    group_name: z.string().optional().describe("Filtrar por grupo. Si se omite, todos los grupos."),
  },
  async ({ group_name }) => {
    const candidates = getReviewCandidates(group_name);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ total: candidates.length, candidates }, null, 2),
      }],
    };
  }
);

// ─── Tool: update_recall_feedback ────────────────────────────────────────────

server.tool(
  "update_recall_feedback",
  "Actualiza el feedback de un recall existente. Usar cuando el feedback guardado está vacío o incompleto — por ejemplo, después de dar el feedback estructurado en la conversación.",
  {
    recall_id: z.number().int().describe("ID del recall a actualizar (visible en get_topic)"),
    feedback:  z.string().describe("Texto completo del feedback estructurado"),
  },
  async ({ recall_id, feedback }) => {
    const result = updateRecallFeedback(recall_id, feedback);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: !result.success,
    };
  }
);

// ─── Tool: update_topic ───────────────────────────────────────────────────────

server.tool(
  "update_topic",
  "Renombra un topic y/o lo mueve a otro grupo. Usar cuando el nombre quedó mal o el topic pertenece a otro grupo.",
  {
    topic_name: z.string().describe("Nombre actual del topic"),
    new_name:   z.string().optional().describe("Nuevo nombre. Omitir si solo se cambia el grupo."),
    group_name: z.string().nullable().optional().describe("Nuevo grupo. Pasar null para quitar el grupo."),
  },
  async ({ topic_name, new_name, group_name }) => {
    const result = updateTopic(topic_name, { new_name, group_name });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: !result.success,
    };
  }
);

// ─── Tool: delete_recall ──────────────────────────────────────────────────────

server.tool(
  "delete_recall",
  "Borra una sesión de recall específica (por ID). Usar cuando el recall fue interrumpido o el score quedó incorrecto.",
  {
    recall_id: z.number().int().describe("ID del recall a borrar (visible en get_topic)"),
  },
  async ({ recall_id }) => {
    const result = deleteRecall(recall_id);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: !result.success,
    };
  }
);

// ─── Tool: merge_topics ───────────────────────────────────────────────────────

server.tool(
  "merge_topics",
  "Fusiona dos topics en uno: mueve todos los recalls del topic origen al destino y lo elimina. " +
  "Usar cuando el mismo concepto fue guardado con dos nombres distintos (ej: 'np.dot' y 'Producto punto').",
  {
    source_topic: z.string().describe("Topic a eliminar (sus recalls se mueven al destino)"),
    target_topic: z.string().describe("Topic que absorbe al origen y queda como definitivo"),
  },
  async ({ source_topic, target_topic }) => {
    const result = mergeTopics(source_topic, target_topic);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: !result.success,
    };
  }
);

// ─── Tool: delete_topic ───────────────────────────────────────────────────────

server.tool(
  "delete_topic",
  "Borra un topic y TODO su historial (subsecciones, recalls, scores). Acción irreversible — confirmar con el usuario antes de llamar.",
  {
    topic_name: z.string().describe("Nombre exacto del topic a borrar"),
  },
  async ({ topic_name }) => {
    const result = deleteTopic(topic_name);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: !result.success,
    };
  }
);

// ─── Arranque ─────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Los logs van a stderr para no interferir con el protocolo MCP (que usa stdout)
  console.error("[recall-mcp] Servidor iniciado. BD en ~/.recall-mcp/recall.db");
}

main().catch((err) => {
  console.error("[recall-mcp] Error fatal:", err);
  process.exit(1);
});