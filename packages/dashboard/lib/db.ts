import Database from "better-sqlite3"
import path from "path"
import os from "os"

const DB_PATH = path.join(os.homedir(), ".recall-mcp", "recall.db")

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: true })
    _db.pragma("journal_mode = WAL")
  }
  return _db
}

export interface TopicRow {
  id: number
  name: string
  description: string | null
  created_at: string
  group_id: number | null
  group_name: string | null
  last_score: number | null
  last_recalled_at: string | null
  total_recalls: number
}

export interface TopicDetail {
  id: number
  name: string
  description: string | null
  created_at: string
  group_id: number | null
  group_name: string | null
}

export interface Subsection {
  id: number
  topic_id: number
  name: string
  order_index: number
}

export interface RecallRow {
  id: number
  topic_id: number
  recalled_at: string
  transcript: string | null
  feedback: string | null
  overall_score: number | null
}

export interface RecallSubsectionRow {
  recall_id: number
  subsection_id: number
  subsection_name: string
  covered: number
  score: number | null
}

export function getTopics(): TopicRow[] {
  const db = getDb()
  return db
    .prepare(
      `
    SELECT
      t.id,
      t.name,
      t.description,
      t.created_at,
      tg.id   AS group_id,
      tg.name AS group_name,
      last_r.overall_score   AS last_score,
      last_r.recalled_at     AS last_recalled_at,
      COUNT(r2.id)           AS total_recalls
    FROM topics t
    LEFT JOIN topic_groups tg ON tg.id = t.group_id
    LEFT JOIN recalls last_r ON last_r.id = (
      SELECT id FROM recalls WHERE topic_id = t.id ORDER BY recalled_at DESC LIMIT 1
    )
    LEFT JOIN recalls r2 ON r2.topic_id = t.id
    GROUP BY t.id
    ORDER BY t.name
  `
    )
    .all() as TopicRow[]
}

export function getTopic(id: number): TopicDetail | undefined {
  const db = getDb()
  return db
    .prepare(
      `
    SELECT t.id, t.name, t.description, t.created_at,
           tg.id AS group_id, tg.name AS group_name
    FROM topics t
    LEFT JOIN topic_groups tg ON tg.id = t.group_id
    WHERE t.id = ?
  `
    )
    .get(id) as TopicDetail | undefined
}

export function getSubsections(topicId: number): Subsection[] {
  const db = getDb()
  return db
    .prepare(
      `SELECT * FROM topic_subsections WHERE topic_id = ? ORDER BY order_index`
    )
    .all(topicId) as Subsection[]
}

export function getRecalls(topicId: number): RecallRow[] {
  const db = getDb()
  return db
    .prepare(
      `SELECT * FROM recalls WHERE topic_id = ? ORDER BY recalled_at DESC`
    )
    .all(topicId) as RecallRow[]
}

export function getRecallSubsections(recallId: number): RecallSubsectionRow[] {
  const db = getDb()
  return db
    .prepare(
      `
    SELECT rs.recall_id, rs.subsection_id, ts.name AS subsection_name, rs.covered, rs.score
    FROM recall_subsections rs
    JOIN topic_subsections ts ON ts.id = rs.subsection_id
    WHERE rs.recall_id = ?
    ORDER BY ts.order_index
  `
    )
    .all(recallId) as RecallSubsectionRow[]
}
