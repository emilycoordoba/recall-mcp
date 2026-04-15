import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { homedir } from "os";

const DB_DIR = path.join(homedir(), ".recall-mcp");
const DB_PATH = path.join(DB_DIR, "recall.db");
fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Activar foreign keys y WAL para mejor performance
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS topic_groups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS topics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    description TEXT,
    group_id    INTEGER REFERENCES topic_groups(id),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Subsecciones canónicas del topic (se definen la primera vez, se pueden ampliar)
  CREATE TABLE IF NOT EXISTS topic_subsections (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id    INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    UNIQUE(topic_id, name)
  );

  CREATE TABLE IF NOT EXISTS recalls (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id      INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    recalled_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    transcript    TEXT,
    feedback      TEXT,
    overall_score REAL
  );

  -- Resultado por subsección en cada recall
  CREATE TABLE IF NOT EXISTS recall_subsections (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    recall_id      INTEGER NOT NULL REFERENCES recalls(id) ON DELETE CASCADE,
    subsection_id  INTEGER NOT NULL REFERENCES topic_subsections(id),
    covered        INTEGER NOT NULL DEFAULT 0,  -- 0 = no, 1 = sí
    score          REAL
  );
`);

export default db;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SubsectionInput {
  name: string;
  covered: boolean;
  score: number;
}

export interface SaveRecallInput {
  topic_name: string;
  group_name?: string;
  transcript?: string;
  feedback?: string;
  overall_score: number;
  subsections: SubsectionInput[];
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Busca topics cuyo nombre contenga el query (case-insensitive) */
export function findTopics(query: string) {
  return db
    .prepare(
      `SELECT t.*, g.name as group_name
       FROM topics t
       LEFT JOIN topic_groups g ON g.id = t.group_id
       WHERE LOWER(t.name) LIKE LOWER(?)
       ORDER BY t.name`
    )
    .all(`%${query}%`);
}

/** Devuelve un topic exacto por nombre */
export function getTopicByName(name: string) {
  return db
    .prepare(
      `SELECT t.*, g.name as group_name
       FROM topics t
       LEFT JOIN topic_groups g ON g.id = t.group_id
       WHERE LOWER(t.name) = LOWER(?)`
    )
    .get(name) as { id: number; name: string; group_name?: string } | undefined;
}

/** Devuelve historial completo de un topic */
export function getTopicHistory(topicId: number) {
  const topic = db
    .prepare(`SELECT * FROM topics WHERE id = ?`)
    .get(topicId) as { id: number; name: string } | undefined;

  if (!topic) return null;

  const subsections = db
    .prepare(
      `SELECT * FROM topic_subsections WHERE topic_id = ? ORDER BY order_index`
    )
    .all(topicId) as { id: number; name: string }[];

  const recalls = db
    .prepare(
      `SELECT * FROM recalls WHERE topic_id = ? ORDER BY recalled_at DESC`
    )
    .all(topicId) as { id: number; recalled_at: string; overall_score: number; transcript: string; feedback: string }[];

  const recallsWithDetails = recalls.map((r) => {
    const recallSubs = db
      .prepare(
        `SELECT rs.*, ts.name as subsection_name
         FROM recall_subsections rs
         JOIN topic_subsections ts ON ts.id = rs.subsection_id
         WHERE rs.recall_id = ?`
      )
      .all(r.id);
    return { ...r, subsections: recallSubs };
  });

  return { ...topic, subsections, recalls: recallsWithDetails };
}

export interface SaveTopicSubsectionsInput {
  topic_name: string;
  group_name?: string;
  subsections: string[];
}

/** Crea el topic y sus subsecciones canónicas ANTES del recall.
 *  Si el topic ya existe, agrega solo las subsecciones nuevas. */
export const saveTopicSubsections = db.transaction((input: SaveTopicSubsectionsInput) => {
  // 1. Crear grupo si se indicó
  let groupId: number | null = null;
  if (input.group_name) {
    db.prepare(`INSERT OR IGNORE INTO topic_groups (name) VALUES (?)`).run(input.group_name);
    const g = db.prepare(`SELECT id FROM topic_groups WHERE name = ?`).get(input.group_name) as { id: number };
    groupId = g.id;
  }

  // 2. Crear topic si no existe
  db.prepare(`INSERT OR IGNORE INTO topics (name, group_id) VALUES (?, ?)`).run(input.topic_name, groupId);
  const topic = db.prepare(`SELECT id FROM topics WHERE LOWER(name) = LOWER(?)`).get(input.topic_name) as { id: number };

  if (groupId) {
    db.prepare(`UPDATE topics SET group_id = ? WHERE id = ? AND group_id IS NULL`).run(groupId, topic.id);
  }

  // 3. Insertar subsecciones nuevas (respeta las existentes por UNIQUE constraint)
  const existingCount = (db.prepare(`SELECT COUNT(*) as c FROM topic_subsections WHERE topic_id = ?`).get(topic.id) as { c: number }).c;

  input.subsections.forEach((name, i) => {
    db.prepare(
      `INSERT OR IGNORE INTO topic_subsections (topic_id, name, order_index) VALUES (?, ?, ?)`
    ).run(topic.id, name, existingCount + i);
  });

  const subsections = db
    .prepare(`SELECT * FROM topic_subsections WHERE topic_id = ? ORDER BY order_index`)
    .all(topic.id);

  return { topic_id: topic.id, subsections };
});

/** Corrige el nombre de una subsección canónica (útil cuando Claude se equivocó) */
export function updateSubsectionName(topicName: string, oldName: string, newName: string) {
  const topic = db
    .prepare(`SELECT id FROM topics WHERE LOWER(name) = LOWER(?)`)
    .get(topicName) as { id: number } | undefined;

  if (!topic) return { success: false, error: `Topic "${topicName}" no encontrado` };

  const result = db
    .prepare(
      `UPDATE topic_subsections SET name = ?
       WHERE topic_id = ? AND LOWER(name) = LOWER(?)`
    )
    .run(newName, topic.id, oldName);

  if (result.changes === 0) {
    return { success: false, error: `Subsección "${oldName}" no encontrada en "${topicName}"` };
  }

  return { success: true, updated: { topic: topicName, old_name: oldName, new_name: newName } };
}

/** Guarda un recall. Las subsecciones ya deben existir (creadas con save_topic_subsections).
 *  Si se pasan subsecciones nuevas, las agrega también (compatibilidad con flujo anterior). */
export const saveRecall = db.transaction((input: SaveRecallInput) => {
  // Asegurar que el topic existe
  let topicId: number;
  const existing = db
    .prepare(`SELECT id FROM topics WHERE LOWER(name) = LOWER(?)`)
    .get(input.topic_name) as { id: number } | undefined;

  if (!existing) {
    // Fallback: crear topic si no se llamó save_topic_subsections antes
    const created = saveTopicSubsections({
      topic_name: input.topic_name,
      group_name: input.group_name,
      subsections: input.subsections.map(s => s.name),
    });
    topicId = created.topic_id;
  } else {
    topicId = existing.id;
  }

  // Agregar subsecciones nuevas que no existan aún
  const existingCount = (db.prepare(`SELECT COUNT(*) as c FROM topic_subsections WHERE topic_id = ?`).get(topicId) as { c: number }).c;
  input.subsections.forEach((sub, i) => {
    db.prepare(
      `INSERT OR IGNORE INTO topic_subsections (topic_id, name, order_index) VALUES (?, ?, ?)`
    ).run(topicId, sub.name, existingCount + i);
  });

  // Crear el recall
  const recallResult = db
    .prepare(`INSERT INTO recalls (topic_id, transcript, feedback, overall_score) VALUES (?, ?, ?, ?)`)
    .run(topicId, input.transcript ?? null, input.feedback ?? null, input.overall_score);

  const recallId = recallResult.lastInsertRowid as number;

  // Guardar resultado por subsección
  input.subsections.forEach((sub) => {
    const subsection = db
      .prepare(`SELECT id FROM topic_subsections WHERE topic_id = ? AND LOWER(name) = LOWER(?)`)
      .get(topicId, sub.name) as { id: number } | undefined;

    if (subsection) {
      db.prepare(
        `INSERT INTO recall_subsections (recall_id, subsection_id, covered, score) VALUES (?, ?, ?, ?)`
      ).run(recallId, subsection.id, sub.covered ? 1 : 0, sub.score);
    }
  });

  return { recall_id: recallId, topic_id: topicId };
});

/** Lista todos los topics con su último recall */
export function listTopics(groupName?: string) {
  const whereClause = groupName
    ? `WHERE LOWER(g.name) = LOWER('${groupName.replace(/'/g, "''")}')`
    : "";

  return db
    .prepare(
      `SELECT
         t.id,
         t.name,
         t.created_at,
         g.name as group_name,
         r.overall_score as last_score,
         r.recalled_at as last_recall,
         COUNT(r2.id) as total_recalls
       FROM topics t
       LEFT JOIN topic_groups g ON g.id = t.group_id
       LEFT JOIN recalls r ON r.id = (
         SELECT id FROM recalls WHERE topic_id = t.id ORDER BY recalled_at DESC LIMIT 1
       )
       LEFT JOIN recalls r2 ON r2.topic_id = t.id
       ${whereClause}
       GROUP BY t.id
       ORDER BY t.name`
    )
    .all();
}

/** Renombra un topic y/o lo mueve a otro grupo */
export function updateTopic(topicName: string, updates: { new_name?: string; group_name?: string | null }) {
  const topic = db
    .prepare(`SELECT id FROM topics WHERE LOWER(name) = LOWER(?)`)
    .get(topicName) as { id: number } | undefined;

  if (!topic) return { success: false, error: `Topic "${topicName}" no encontrado` };

  if (updates.new_name !== undefined) {
    const existing = db
      .prepare(`SELECT id FROM topics WHERE LOWER(name) = LOWER(?) AND id != ?`)
      .get(updates.new_name, topic.id);
    if (existing) return { success: false, error: `Ya existe un topic llamado "${updates.new_name}"` };
    db.prepare(`UPDATE topics SET name = ? WHERE id = ?`).run(updates.new_name, topic.id);
  }

  if (updates.group_name !== undefined) {
    let groupId: number | null = null;
    if (updates.group_name !== null) {
      db.prepare(`INSERT OR IGNORE INTO topic_groups (name) VALUES (?)`).run(updates.group_name);
      const g = db.prepare(`SELECT id FROM topic_groups WHERE name = ?`).get(updates.group_name) as { id: number };
      groupId = g.id;
    }
    db.prepare(`UPDATE topics SET group_id = ? WHERE id = ?`).run(groupId, topic.id);
  }

  return { success: true, topic_id: topic.id };
}

/** Borra un recall y sus recall_subsections (CASCADE) */
export function deleteRecall(recallId: number) {
  const recall = db
    .prepare(`SELECT id, topic_id FROM recalls WHERE id = ?`)
    .get(recallId) as { id: number; topic_id: number } | undefined;

  if (!recall) return { success: false, error: `Recall #${recallId} no encontrado` };

  db.prepare(`DELETE FROM recalls WHERE id = ?`).run(recallId);
  return { success: true, deleted_recall_id: recallId, topic_id: recall.topic_id };
}

/** Fusiona source_topic en target_topic: mueve recalls y subsecciones nuevas, luego borra el source */
export const mergeTopics = db.transaction((sourceName: string, targetName: string) => {
  const source = db
    .prepare(`SELECT id FROM topics WHERE LOWER(name) = LOWER(?)`)
    .get(sourceName) as { id: number } | undefined;
  const target = db
    .prepare(`SELECT id FROM topics WHERE LOWER(name) = LOWER(?)`)
    .get(targetName) as { id: number } | undefined;

  if (!source) return { success: false, error: `Topic origen "${sourceName}" no encontrado` };
  if (!target) return { success: false, error: `Topic destino "${targetName}" no encontrado` };
  if (source.id === target.id) return { success: false, error: "Origen y destino son el mismo topic" };

  // Mover recalls al topic destino
  db.prepare(`UPDATE recalls SET topic_id = ? WHERE topic_id = ?`).run(target.id, source.id);

  // Agregar subsecciones del source que no existan en el target
  const targetCount = (db.prepare(`SELECT COUNT(*) as c FROM topic_subsections WHERE topic_id = ?`).get(target.id) as { c: number }).c;
  const sourceSubs = db.prepare(`SELECT name FROM topic_subsections WHERE topic_id = ? ORDER BY order_index`).all(source.id) as { name: string }[];

  sourceSubs.forEach((sub, i) => {
    db.prepare(`INSERT OR IGNORE INTO topic_subsections (topic_id, name, order_index) VALUES (?, ?, ?)`)
      .run(target.id, sub.name, targetCount + i);
  });

  // Borrar el topic fuente (CASCADE elimina sus topic_subsections huérfanas)
  db.prepare(`DELETE FROM topics WHERE id = ?`).run(source.id);

  return { success: true, merged_into: targetName, recalls_moved: sourceSubs.length };
});

/** Borra un topic y todo su historial (CASCADE: subsecciones, recalls, recall_subsections) */
export function deleteTopic(topicName: string) {
  const topic = db
    .prepare(`SELECT id FROM topics WHERE LOWER(name) = LOWER(?)`)
    .get(topicName) as { id: number } | undefined;

  if (!topic) return { success: false, error: `Topic "${topicName}" no encontrado` };

  const recallCount = (db.prepare(`SELECT COUNT(*) as c FROM recalls WHERE topic_id = ?`).get(topic.id) as { c: number }).c;
  db.prepare(`DELETE FROM topics WHERE id = ?`).run(topic.id);

  return { success: true, deleted_topic: topicName, recalls_deleted: recallCount };
}

/** Filtra y ordena topics por criterio */
export function filterTopics(
  sortBy: "score_asc" | "score_desc" | "date_asc" | "date_desc" | "name",
  groupName?: string
) {
  const orderMap = {
    score_asc:  "last_score ASC NULLS LAST",
    score_desc: "last_score DESC NULLS LAST",
    date_asc:   "last_recall ASC NULLS LAST",
    date_desc:  "last_recall DESC NULLS LAST",
    name:       "t.name ASC",
  };

  const whereClause = groupName
    ? `WHERE LOWER(g.name) = LOWER('${groupName.replace(/'/g, "''")}')`
    : "";

  return db
    .prepare(
      `SELECT
         t.id,
         t.name,
         g.name as group_name,
         r.overall_score as last_score,
         r.recalled_at as last_recall,
         COUNT(r2.id) as total_recalls
       FROM topics t
       LEFT JOIN topic_groups g ON g.id = t.group_id
       LEFT JOIN recalls r ON r.id = (
         SELECT id FROM recalls WHERE topic_id = t.id ORDER BY recalled_at DESC LIMIT 1
       )
       LEFT JOIN recalls r2 ON r2.topic_id = t.id
       ${whereClause}
       GROUP BY t.id
       ORDER BY ${orderMap[sortBy]}`
    )
    .all();
}
