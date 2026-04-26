import { supabase } from "./supabase";

const RECENT_WINDOW = 5;

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface TopicRow {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  group_id: number | null;
  group_name: string | null;
  last_score: number | null;
  last_recalled_at: string | null;
  total_recalls: number;
  total_quick_reviews: number;
  urgency: number;
  score_trend: "up" | "down" | "flat" | null;
}

export interface TopicDetail {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  group_id: number | null;
  group_name: string | null;
}

export interface Subsection {
  id: number;
  topic_id: number;
  name: string;
  order_index: number;
}

export interface RecallRow {
  id: number;
  topic_id: number;
  recalled_at: string;
  transcript: string | null;
  feedback: string | null;
  overall_score: number | null;
}

export interface RecallSubsectionRow {
  recall_id: number;
  subsection_id: number;
  subsection_name: string;
  covered: boolean;
  score: number | null;
}

export interface QuickReviewRow {
  id: number;
  topic_id: number;
  reviewed_at: string;
  overall_score: number | null;
  feedback: string | null;
}

export interface QuickReviewAnswerRow {
  id: number;
  session_id: number;
  subsection_name: string | null;
  question: string;
  answer: string | null;
  score: number | null;
  feedback: string | null;
}

export async function getStudyStreak(): Promise<number> {
  const [{ data: recalls }, { data: qrs }] = await Promise.all([
    supabase.from("recalls").select("recalled_at"),
    supabase.from("quick_review_sessions").select("reviewed_at"),
  ]);

  const allDays = new Set([
    ...(recalls ?? []).map((r) => localDateStr(new Date(r.recalled_at))),
    ...(qrs ?? []).map((q) => localDateStr(new Date(q.reviewed_at))),
  ]);

  let streak = 0;
  const cur = new Date();
  while (allDays.has(localDateStr(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

export async function getTopics(): Promise<TopicRow[]> {
  const { data, error } = await supabase
    .from("topics")
    .select(`
      id, name, description, created_at, group_id,
      topic_groups(name),
      recalls(overall_score, recalled_at),
      quick_review_sessions(reviewed_at, overall_score)
    `)
    .order("name");

  if (error) throw error;

  return (data ?? []).map((t) => {
    const recalls = (t.recalls as { overall_score: number; recalled_at: string }[]) ?? [];
    const qrs = (t.quick_review_sessions as { reviewed_at: string; overall_score: number }[]) ?? [];

    // All sessions sorted most recent first
    const allSessions = [
      ...recalls.map((r) => ({ date: r.recalled_at, score: r.overall_score })),
      ...qrs.map((q) => ({ date: q.reviewed_at, score: q.overall_score })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    const lastRecalledAt = allSessions[0]?.date ?? null;

    // Item 10: last_score from most recent session (recall or QR)
    const last_score = allSessions[0]?.score ?? null;

    // Urgency — same formula as getReviewCandidates
    const sortedRecalls = [...recalls].sort((a, b) => b.recalled_at.localeCompare(a.recalled_at));
    const lastRecallDate = sortedRecalls[0]?.recalled_at ?? null;
    const daysSinceFullRecall = lastRecallDate
      ? Math.floor((Date.now() - new Date(lastRecallDate).getTime()) / 86_400_000)
      : null;
    const daysSinceAny = lastRecalledAt
      ? Math.floor((Date.now() - new Date(lastRecalledAt).getTime()) / 86_400_000)
      : null;
    const recentSessions = allSessions.slice(0, RECENT_WINDOW);
    const avgScore = recentSessions.length
      ? recentSessions.reduce((s, r) => s + r.score, 0) / recentSessions.length
      : null;
    const consolidation = Math.log(recalls.length + Math.E);
    const urgencyDays = daysSinceFullRecall ?? daysSinceAny ?? 0;
    const urgency = recalls.length === 0 && qrs.length === 0
      ? 999
      : Math.round((urgencyDays / ((avgScore ?? 0) + 1) / consolidation) * 100) / 100;

    // Item 4: score trend — last 3 sessions vs previous 3
    let score_trend: "up" | "down" | "flat" | null = null;
    if (allSessions.length >= 4) {
      const recent = allSessions.slice(0, 3);
      const prev = allSessions.slice(3, 6);
      const recentAvg = recent.reduce((s, r) => s + r.score, 0) / recent.length;
      const prevAvg = prev.reduce((s, r) => s + r.score, 0) / prev.length;
      const diff = recentAvg - prevAvg;
      score_trend = diff > 0.3 ? "up" : diff < -0.3 ? "down" : "flat";
    }

    return {
      id: t.id,
      name: t.name,
      description: t.description,
      created_at: t.created_at,
      group_id: t.group_id,
      group_name: (t.topic_groups as { name: string } | null)?.name ?? null,
      last_score,
      last_recalled_at: lastRecalledAt,
      total_recalls: recalls.length,
      total_quick_reviews: qrs.length,
      urgency,
      score_trend,
    };
  });
}

export async function getTopic(id: number): Promise<TopicDetail | undefined> {
  const { data, error } = await supabase
    .from("topics")
    .select("id, name, description, created_at, group_id, topic_groups(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return undefined;

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    created_at: data.created_at,
    group_id: data.group_id,
    group_name: (data.topic_groups as { name: string } | null)?.name ?? null,
  };
}

export async function getSubsections(topicId: number): Promise<Subsection[]> {
  const { data, error } = await supabase
    .from("topic_subsections")
    .select("*")
    .eq("topic_id", topicId)
    .order("order_index");

  if (error) throw error;
  return (data ?? []) as Subsection[];
}

export interface SubsectionStat extends Subsection {
  practice_count: number;
}

export async function getSubsectionStats(topicId: number): Promise<SubsectionStat[]> {
  const { data, error } = await supabase
    .from("topic_subsections")
    .select("id, topic_id, name, order_index, recall_subsections(id), quick_review_answers(id)")
    .eq("topic_id", topicId)
    .order("order_index");

  if (error) throw error;

  return ((data ?? []) as any[]).map((s) => ({
    id: s.id,
    topic_id: s.topic_id,
    name: s.name,
    order_index: s.order_index,
    practice_count: (s.recall_subsections?.length ?? 0) + (s.quick_review_answers?.length ?? 0),
  }));
}

export async function getRecalls(topicId: number): Promise<RecallRow[]> {
  const { data, error } = await supabase
    .from("recalls")
    .select("*")
    .eq("topic_id", topicId)
    .order("recalled_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as RecallRow[];
}

export async function getRecallSubsections(recallId: number): Promise<RecallSubsectionRow[]> {
  const { data, error } = await supabase
    .from("recall_subsections")
    .select("recall_id, subsection_id, covered, score, topic_subsections(name, order_index)")
    .eq("recall_id", recallId)
    .order("order_index", { referencedTable: "topic_subsections" });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    recall_id: row.recall_id,
    subsection_id: row.subsection_id,
    subsection_name: (row.topic_subsections as { name: string } | null)?.name ?? "",
    covered: row.covered,
    score: row.score,
  }));
}

export async function getQuickReviews(topicId: number): Promise<QuickReviewRow[]> {
  const { data, error } = await supabase
    .from("quick_review_sessions")
    .select("id, topic_id, reviewed_at, overall_score, feedback")
    .eq("topic_id", topicId)
    .order("reviewed_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as QuickReviewRow[];
}

export interface HistorySubsection {
  name: string;
  covered: boolean;
  score: number | null;
}

export interface HistoryAnswer {
  subsection_name: string | null;
  question: string;
  answer: string | null;
  score: number | null;
  feedback: string | null;
}

export interface HistoryEntry {
  id: number;
  type: "recall" | "quick_review";
  date: string;
  topic_id: number;
  topic_name: string;
  group_name: string | null;
  score: number | null;
  feedback: string | null;
  subsections: HistorySubsection[];
  answers: HistoryAnswer[];
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const [{ data: recalls, error: re }, { data: qrs, error: qe }] = await Promise.all([
    supabase
      .from("recalls")
      .select(`
        id, recalled_at, overall_score, feedback, topic_id,
        topics(name, topic_groups(name)),
        recall_subsections(covered, score, topic_subsections(name, order_index))
      `)
      .order("recalled_at", { ascending: false }),
    supabase
      .from("quick_review_sessions")
      .select(`
        id, reviewed_at, overall_score, topic_id,
        topics(name, topic_groups(name)),
        quick_review_answers(question, answer, score, feedback, topic_subsections(name))
      `)
      .order("reviewed_at", { ascending: false }),
  ]);

  if (re) throw re;
  if (qe) throw qe;

  const recallEntries: HistoryEntry[] = ((recalls ?? []) as any[]).map((r) => ({
    id: r.id,
    type: "recall" as const,
    date: r.recalled_at,
    topic_id: r.topic_id,
    topic_name: r.topics?.name ?? "Unknown",
    group_name: r.topics?.topic_groups?.name ?? null,
    score: r.overall_score,
    feedback: r.feedback ?? null,
    subsections: (r.recall_subsections ?? []).map((s: any) => ({
      name: s.topic_subsections?.name ?? "?",
      covered: Boolean(s.covered),
      score: s.score,
    })),
    answers: [],
  }));

  const qrEntries: HistoryEntry[] = ((qrs ?? []) as any[]).map((q) => ({
    id: q.id,
    type: "quick_review" as const,
    date: q.reviewed_at,
    topic_id: q.topic_id,
    topic_name: q.topics?.name ?? "Unknown",
    group_name: q.topics?.topic_groups?.name ?? null,
    score: q.overall_score,
    feedback: null,
    subsections: [],
    answers: (q.quick_review_answers ?? []).map((a: any) => ({
      subsection_name: a.topic_subsections?.name ?? null,
      question: a.question,
      answer: a.answer ?? null,
      score: a.score,
      feedback: a.feedback ?? null,
    })),
  }));

  return [...recallEntries, ...qrEntries].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getQuickReviewAnswers(sessionId: number): Promise<QuickReviewAnswerRow[]> {
  const { data, error } = await supabase
    .from("quick_review_answers")
    .select("id, session_id, question, answer, score, feedback, topic_subsections(name)")
    .eq("session_id", sessionId)
    .order("id");

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    session_id: row.session_id,
    subsection_name: (row.topic_subsections as { name: string } | null)?.name ?? null,
    question: row.question,
    answer: row.answer,
    score: row.score,
    feedback: row.feedback ?? null,
  }));
}
