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
  total_quick_reviews: number
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

export interface QuickReviewRow {
  id: number
  topic_id: number
  reviewed_at: string
  overall_score: number | null
}

export interface QuickReviewAnswerRow {
  id: number
  session_id: number
  subsection_name: string | null
  question: string
  answer: string | null
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
      MAX(COALESCE(last_r.recalled_at, ''), COALESCE(last_qr.reviewed_at, '')) AS last_recalled_at,
      COUNT(DISTINCT r2.id)  AS total_recalls,
      COUNT(DISTINCT qr2.id) AS total_quick_reviews
    FROM topics t
    LEFT JOIN topic_groups tg ON tg.id = t.group_id
    LEFT JOIN recalls last_r ON last_r.id = (
      SELECT id FROM recalls WHERE topic_id = t.id ORDER BY recalled_at DESC LIMIT 1
    )
    LEFT JOIN recalls r2 ON r2.topic_id = t.id
    LEFT JOIN quick_reviews qr2 ON qr2.topic_id = t.id
    LEFT JOIN quick_reviews last_qr ON last_qr.id = (
      SELECT id FROM quick_reviews WHERE topic_id = t.id ORDER BY reviewed_at DESC LIMIT 1
    )
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

export function getQuickReviews(topicId: number): QuickReviewRow[] {
  const db = getDb()
  return db
    .prepare(`SELECT * FROM quick_reviews WHERE topic_id = ? ORDER BY reviewed_at DESC`)
    .all(topicId) as QuickReviewRow[]
}

export function getQuickReviewAnswers(sessionId: number): QuickReviewAnswerRow[] {
  const db = getDb()
  return db
    .prepare(`
      SELECT qra.id, qra.session_id, ts.name AS subsection_name,
             qra.question, qra.answer, qra.score
      FROM quick_review_answers qra
      LEFT JOIN topic_subsections ts ON ts.id = qra.subsection_id
      WHERE qra.session_id = ?
      ORDER BY qra.id
    `)
    .all(sessionId) as QuickReviewAnswerRow[]
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
