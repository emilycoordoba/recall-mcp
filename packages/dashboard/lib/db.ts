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
  retention: number | null;
  effective_score: number | null;
  next_review_date: string | null;
  days_overdue: number | null;
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

export async function getStudyStreak(userId: number): Promise<number> {
  const [{ data: recalls }, { data: qrs }] = await Promise.all([
    supabase.from("recalls").select("recalled_at").eq("user_id", userId),
    supabase.from("quick_review_sessions").select("reviewed_at").eq("user_id", userId),
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

export async function getTopics(userId: number): Promise<TopicRow[]> {
  const { data, error } = await supabase
    .from("topics")
    .select(`
      id, name, description, created_at, group_id,
      topic_groups(name),
      recalls(overall_score, recalled_at, format),
      quick_review_sessions(reviewed_at, overall_score)
    `)
    .eq("user_id", userId)
    .order("name");

  if (error) throw error;

  return (data ?? []).map((t) => {
    const recalls = (t.recalls as { overall_score: number; recalled_at: string; format: string | null }[]) ?? [];
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

    // SM-2: only full recalls count toward interval — directed recalls are partial and don't evidence full retention
    const sortedForSM2 = recalls
      .filter((r) => (r.format ?? "completo") === "completo")
      .sort((a, b) => a.recalled_at.localeCompare(b.recalled_at));
    let sm2Interval = 1, sm2EF = 2.5, sm2Reps = 0;
    for (const r of sortedForSM2) {
      const q = r.overall_score ?? 0;
      if (q >= 3) {
        if (sm2Reps === 0) sm2Interval = 3;
        else if (sm2Reps === 1) sm2Interval = 14;
        else sm2Interval = Math.round(sm2Interval * sm2EF);
        sm2Reps++;
      } else {
        sm2Reps = 0;
        sm2Interval = 3;
      }
      sm2EF = Math.max(1.3, sm2EF + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    }
    const lastRecallIso = sortedForSM2.at(-1)?.recalled_at ?? null;
    const next_review_date = lastRecallIso
      ? new Date(new Date(lastRecallIso).getTime() + sm2Interval * 86_400_000).toISOString().slice(0, 10)
      : null;
    const todayIso = localDateStr(new Date());
    const days_overdue = next_review_date
      ? Math.round((Date.parse(todayIso) - Date.parse(next_review_date)) / 86_400_000)
      : null;

    // Forgetting curve: R = e^(-daysSince / stability)
    // Only meaningful after ≥3 recalls — below that there's not enough history to model decay
    const daysSinceRecall = lastRecallIso
      ? Math.floor((Date.now() - new Date(lastRecallIso).getTime()) / 86_400_000)
      : null;
    const stability = Math.max(7, sm2Interval);
    const retention =
      recalls.length >= 3 && daysSinceRecall !== null && last_score !== null
        ? Math.round(Math.exp(-daysSinceRecall / stability) * 100) / 100
        : null;
    const effective_score =
      last_score !== null && retention !== null
        ? Math.round(last_score * retention * 100) / 100
        : null;

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
      retention,
      effective_score,
      next_review_date,
      days_overdue,
    };
  });
}

export async function getTopic(id: number, userId: number): Promise<TopicDetail | undefined> {
  const { data, error } = await supabase
    .from("topics")
    .select("id, name, description, created_at, group_id, topic_groups(name)")
    .eq("id", id)
    .eq("user_id", userId)
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

export async function getSubsections(topicId: number, userId: number): Promise<Subsection[]> {
  const { data, error } = await supabase
    .from("topic_subsections")
    .select("*")
    .eq("topic_id", topicId)
    .eq("user_id", userId)
    .order("order_index");

  if (error) throw error;
  return (data ?? []) as Subsection[];
}

export interface SubsectionStat extends Subsection {
  practice_count: number;
  avg_score: number | null;
  mastered: boolean;
}

export async function getSubsectionStats(topicId: number, userId: number): Promise<SubsectionStat[]> {
  const { data, error } = await supabase
    .from("topic_subsections")
    .select("id, topic_id, name, order_index, recall_subsections(recall_id, covered, score), quick_review_answers(score)")
    .eq("topic_id", topicId)
    .eq("user_id", userId)
    .order("order_index");

  if (error) throw error;

  return ((data ?? []) as any[]).map((s) => {
    const recallScores: number[] = (s.recall_subsections ?? []).map((r: any) => r.score).filter((v: any) => v !== null);
    const qrScores: number[] = (s.quick_review_answers ?? []).map((q: any) => q.score).filter((v: any) => v !== null);
    const allScores = [...recallScores, ...qrScores];
    const recentRs = ([...(s.recall_subsections ?? [])] as any[]).sort((a, b) => b.recall_id - a.recall_id).slice(0, RECENT_WINDOW);
    const recallMisses: number = recentRs.filter((r: any) => !r.covered).length;
    const practice_count = allScores.length;
    const avg_score = allScores.length ? allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length : null;
    const mastered = practice_count >= RECENT_WINDOW && avg_score !== null && avg_score >= 4.5 && recallMisses === 0;
    return { id: s.id, topic_id: s.topic_id, name: s.name, order_index: s.order_index, practice_count, avg_score, mastered };
  });
}

export async function getRecalls(topicId: number, userId: number): Promise<RecallRow[]> {
  const { data, error } = await supabase
    .from("recalls")
    .select("*")
    .eq("topic_id", topicId)
    .eq("user_id", userId)
    .order("recalled_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as RecallRow[];
}

export async function getRecallSubsections(recallId: number, userId: number): Promise<RecallSubsectionRow[]> {
  // recall_subsections has no user_id; scope via the owning recall (inner join).
  const { data, error } = await supabase
    .from("recall_subsections")
    .select("recall_id, subsection_id, covered, score, topic_subsections(name, order_index), recalls!inner(user_id)")
    .eq("recall_id", recallId)
    .eq("recalls.user_id", userId)
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

export async function getQuickReviews(topicId: number, userId: number): Promise<QuickReviewRow[]> {
  const { data, error } = await supabase
    .from("quick_review_sessions")
    .select("id, topic_id, reviewed_at, overall_score, feedback")
    .eq("topic_id", topicId)
    .eq("user_id", userId)
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

export async function getHistory(userId: number): Promise<HistoryEntry[]> {
  const [{ data: recalls, error: re }, { data: qrs, error: qe }] = await Promise.all([
    supabase
      .from("recalls")
      .select(`
        id, recalled_at, overall_score, feedback, topic_id,
        topics(name, topic_groups(name)),
        recall_subsections(covered, score, topic_subsections(name, order_index))
      `)
      .eq("user_id", userId)
      .order("recalled_at", { ascending: false }),
    supabase
      .from("quick_review_sessions")
      .select(`
        id, reviewed_at, overall_score, topic_id,
        topics(name, topic_groups(name)),
        quick_review_answers(question, answer, score, feedback, topic_subsections(name))
      `)
      .eq("user_id", userId)
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

export interface ReviewSessionSlot {
  slot_number: number;
  format: "quick" | "recall_dirigido" | "recall_completo";
  topic_id: number;
  topic_name: string;
  subsection_names: string[];
  score: number | null;
  record_type: "recall" | "quick_review" | null;
  record_id: number | null;
}

export interface ReviewSessionEntry {
  id: number;
  started_at: string;
  group_name: string | null;
  slots: ReviewSessionSlot[];
}

export async function getReviewSessions(userId: number): Promise<ReviewSessionEntry[]> {
  const { data, error } = await supabase
    .from("review_sessions")
    .select(`
      id, started_at, group_name,
      review_session_slots(slot_number, format, subsection_names, topics(id, name)),
      recalls(id, topic_id, overall_score, review_session_id),
      quick_review_sessions(id, topic_id, overall_score, review_session_id)
    `)
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return ((data ?? []) as any[]).map((session) => {
    const recalls: { id: number; topic_id: number; overall_score: number | null }[] = session.recalls ?? [];
    const qrs: { id: number; topic_id: number; overall_score: number | null }[] = session.quick_review_sessions ?? [];

    const recallByTopic = new Map(recalls.map((r) => [r.topic_id, r]));
    const qrByTopic = new Map(qrs.map((q) => [q.topic_id, q]));

    const slots: ReviewSessionSlot[] = ((session.review_session_slots ?? []) as any[])
      .sort((a: any, b: any) => a.slot_number - b.slot_number)
      .map((slot: any) => {
        const topicId = (slot.topics as { id: number; name: string } | null)?.id ?? 0;
        const topicName = (slot.topics as { id: number; name: string } | null)?.name ?? "?";
        const format = slot.format as ReviewSessionSlot["format"];

        const recall = recallByTopic.get(topicId);
        const qr = qrByTopic.get(topicId);

        // recall_completo and recall_dirigido link to recalls; quick links to quick_review_sessions
        const linked = format === "quick" ? qr : recall;
        const recordType = format === "quick" ? (qr ? "quick_review" : null) : (recall ? "recall" : null);

        return {
          slot_number: slot.slot_number,
          format,
          topic_id: topicId,
          topic_name: topicName,
          subsection_names: slot.subsection_names ?? [],
          score: linked?.overall_score ?? null,
          record_type: recordType,
          record_id: linked?.id ?? null,
        };
      });

    return {
      id: session.id,
      started_at: session.started_at,
      group_name: session.group_name,
      slots,
    };
  });
}

export async function getQuickReviewAnswers(sessionId: number, userId: number): Promise<QuickReviewAnswerRow[]> {
  // quick_review_answers has no user_id; scope via the owning session (inner join).
  const { data, error } = await supabase
    .from("quick_review_answers")
    .select("id, session_id, question, answer, score, feedback, topic_subsections(name), quick_review_sessions!inner(user_id)")
    .eq("session_id", sessionId)
    .eq("quick_review_sessions.user_id", userId)
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
