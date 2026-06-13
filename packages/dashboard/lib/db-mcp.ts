import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  format?: "completo" | "dirigido";
  session_id?: number;
  subsections: SubsectionInput[];
}

export interface SaveTopicSubsectionsInput {
  topic_name: string;
  group_name?: string;
  subsections: string[];
}

export interface QuickReviewAnswerInput {
  subsection_name: string;
  question: string;
  answer: string;
  score: number;
  feedback?: string;
}

export interface SaveQuickReviewInput {
  topic_name: string;
  overall_score: number;
  feedback?: string;
  session_id?: number;
  answers: QuickReviewAnswerInput[];
}

export interface Stats {
  total_topics: number;
  total_recalls: number;
  total_quick_reviews: number;
  avg_score: number | null;
  topics_below_3: number;
  topics_never_recalled: number;
  study_streak_days: number;
  last_session_date: string | null;
  most_active_group: string | null;
}

export interface ReviewCandidate {
  topic_id: number;
  topic_name: string;
  group_name: string | null;
  days_since_recall: number | null;
  days_since_full_recall: number | null;
  avg_score: number | null;
  urgency: number;
  total_recalls: number;
  // Recalls + quick reviews. total_recalls counts only full recalls, so a
  // quick-review-only topic (e.g. math practice) has total_recalls 0 but
  // total_sessions > 0 — this is the field that means "practiced at least once".
  total_sessions: number;
  next_review_date: string | null;
  days_overdue: number;
  sm2_interval: number;
  subsections: { name: string; avg_score: number | null; times_missed: number; mastered: boolean; recent_questions: string[] }[];
}

// ─── User resolution ──────────────────────────────────────────────────────────

export interface User {
  id: number;
  name: string;
}

// Resolves the user owning a given MCP bearer token. Returns null when the token
// is unknown — callers must treat that as 401.
export async function getUserByToken(token: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name")
    .eq("mcp_token", token)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// ─── User settings ────────────────────────────────────────────────────────────
// Per-user preferences stored in users.settings (jsonb). New keys can be added
// here without a migration; DEFAULT_SETTINGS fills any absent key so old rows
// (settings = '{}') and partially-set rows behave predictably.

export interface UserSettings {
  // When true, topics with zero practice sessions are kept out of the spaced
  // review plan and surfaced separately as "new topics to start". Defaults true:
  // pushing a never-practiced topic into spaced repetition is what flooded the
  // session with unfamiliar material.
  review_only_practiced: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  review_only_practiced: true,
};

export async function getUserSettings(userId: number): Promise<UserSettings> {
  const { data, error } = await supabase
    .from("users")
    .select("settings")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    // 42703 = undefined_column: la migración que agrega users.settings aún no
    // corrió. Caer a defaults mantiene el plan de repaso funcionando (deploy-safe
    // si el código llega antes que la migración). Cualquier otro error sí se propaga.
    if (error.code === "42703") return { ...DEFAULT_SETTINGS };
    throw error;
  }
  return { ...DEFAULT_SETTINGS, ...((data?.settings as Partial<UserSettings>) ?? {}) };
}

// Merges a partial patch over the stored settings and persists the result.
// Returns the full, defaulted settings so callers can echo the new state.
export async function updateUserSettings(
  userId: number,
  patch: Partial<UserSettings>,
): Promise<UserSettings> {
  const current = await getUserSettings(userId);
  const next = { ...current, ...patch };
  const { error } = await supabase
    .from("users")
    .update({ settings: next })
    .eq("id", userId);
  if (error) throw error;
  return next;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOrCreateGroup(name: string, userId: number): Promise<number> {
  const { data: existing } = await supabase
    .from("topic_groups")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("topic_groups")
    .insert({ name, user_id: userId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function getOrCreateTopic(name: string, groupId: number | null, userId: number): Promise<number> {
  const { data: existing } = await supabase
    .from("topics")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("topics")
    .insert({ name, group_id: groupId, user_id: userId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// ─── Read operations ──────────────────────────────────────────────────────────

export async function findTopics(query: string, userId: number) {
  const [{ data: topicData, error: te }, { data: subsData, error: se }] = await Promise.all([
    supabase
      .from("topics")
      .select("id, name, group_id, topic_groups!topics_group_id_fkey(name)")
      .eq("user_id", userId)
      .ilike("name", `%${query}%`)
      .order("name"),
    supabase
      .from("topic_subsections")
      .select("name, topic_id, topics(id, name, group_id, topic_groups!topics_group_id_fkey(name))")
      .eq("user_id", userId)
      .ilike("name", `%${query}%`),
  ]);
  if (te) throw te;
  if (se) throw se;

  const map = new Map<number, {
    id: number; name: string; group_name: string | null;
    match_type: "topic" | "subsection" | "both";
    matched_subsections: string[];
  }>();

  for (const t of topicData ?? []) {
    map.set(t.id, {
      id: t.id,
      name: t.name,
      group_name: (t.topic_groups as unknown as { name: string } | null)?.name ?? null,
      match_type: "topic",
      matched_subsections: [],
    });
  }

  for (const s of subsData ?? []) {
    const parent = s.topics as unknown as { id: number; name: string; group_id: number | null; topic_groups: { name: string } | null } | null;
    if (!parent) continue;
    const existing = map.get(parent.id);
    if (existing) {
      existing.match_type = "both";
      existing.matched_subsections.push(s.name);
    } else {
      map.set(parent.id, {
        id: parent.id,
        name: parent.name,
        group_name: (parent.topic_groups as unknown as { name: string } | null)?.name ?? null,
        match_type: "subsection",
        matched_subsections: [s.name],
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTopicByName(name: string, userId: number) {
  const { data, error } = await supabase
    .from("topics")
    .select("id, name, group_id, topic_groups!topics_group_id_fkey(name)")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    group_name: (data.topic_groups as unknown as { name: string } | null)?.name ?? null,
  };
}

export async function getTopicHistory(topicId: number, userId: number) {
  const { data: topic, error: te } = await supabase
    .from("topics")
    .select("id, name")
    .eq("id", topicId)
    .eq("user_id", userId)
    .maybeSingle();
  if (te) throw te;
  if (!topic) return null;

  const { data: subsections } = await supabase
    .from("topic_subsections")
    .select("*")
    .eq("topic_id", topicId)
    .order("order_index");

  const { data: recalls } = await supabase
    .from("recalls")
    .select("*")
    .eq("topic_id", topicId)
    .order("recalled_at", { ascending: false });

  const recallsWithSubs = await Promise.all(
    (recalls ?? []).map(async (r) => {
      const { data: subs } = await supabase
        .from("recall_subsections")
        .select("*, topic_subsections(name)")
        .eq("recall_id", r.id);
      return {
        ...r,
        subsections: (subs ?? []).map((s) => ({
          ...s,
          subsection_name: (s.topic_subsections as unknown as { name: string } | null)?.name ?? "",
          topic_subsections: undefined,
        })),
      };
    }),
  );

  return { ...topic, subsections: subsections ?? [], recalls: recallsWithSubs };
}

export async function listTopics(userId: number, groupName?: string) {
  let query = supabase
    .from("topics")
    .select(`id, name, created_at, group_id, topic_groups!topics_group_id_fkey(name), recalls(overall_score, recalled_at)`)
    .eq("user_id", userId)
    .order("name");

  if (groupName) {
    const { data: group } = await supabase
      .from("topic_groups")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", groupName)
      .maybeSingle();
    if (group) query = query.eq("group_id", group.id);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((t) => {
    const recalls = (t.recalls as { overall_score: number; recalled_at: string }[]) ?? [];
    const sorted = [...recalls].sort((a, b) => b.recalled_at.localeCompare(a.recalled_at));
    return {
      id: t.id,
      name: t.name,
      created_at: t.created_at,
      group_name: (t.topic_groups as unknown as { name: string } | null)?.name ?? null,
      last_score: sorted[0]?.overall_score ?? null,
      last_recall: sorted[0]?.recalled_at ?? null,
      total_recalls: recalls.length,
    };
  });
}

export async function filterTopics(
  userId: number,
  sortBy: "score_asc" | "score_desc" | "date_asc" | "date_desc" | "name",
  groupName?: string,
) {
  const rows = await listTopics(userId, groupName);

  return rows.sort((a, b) => {
    switch (sortBy) {
      case "score_asc":  return (a.last_score ?? -1) - (b.last_score ?? -1);
      case "score_desc": return (b.last_score ?? -1) - (a.last_score ?? -1);
      case "date_asc":   return (a.last_recall ?? "").localeCompare(b.last_recall ?? "");
      case "date_desc":  return (b.last_recall ?? "").localeCompare(a.last_recall ?? "");
      default:           return a.name.localeCompare(b.name);
    }
  });
}

// Number of most recent recall sessions used to compute scores and times_missed.
// Keeps metrics reflecting current knowledge rather than accumulating indefinitely.
const RECENT_WINDOW = 5;

// Shape of the nested Supabase result for getReviewCandidates. Supabase types
// embeds loosely (often as arrays), so we assert this via `unknown` at the cast.
interface CandidateSubRow {
  name: string;
  recall_subsections: { recall_id: number; covered: boolean; score: number }[];
  quick_review_answers: { session_id: number; score: number; question: string | null }[];
}
interface CandidateRow {
  id: number;
  name: string;
  topic_groups: { name: string } | null;
  recalls: { id: number; recalled_at: string; overall_score: number; format: string | null }[];
  quick_review_sessions: { id: number; reviewed_at: string; overall_score: number }[];
  topic_subsections: CandidateSubRow[];
}

export async function getReviewCandidates(userId: number, groupName?: string): Promise<ReviewCandidate[]> {
  let query = supabase
    .from("topics")
    .select(`
      id, name,
      topic_groups!topics_group_id_fkey(name),
      recalls(id, recalled_at, overall_score, format),
      quick_review_sessions(id, reviewed_at, overall_score),
      topic_subsections(
        id, name,
        recall_subsections(recall_id, covered, score),
        quick_review_answers(session_id, score, question)
      )
    `)
    .eq("user_id", userId)
    .order("name");

  if (groupName) {
    const { data: group } = await supabase
      .from("topic_groups")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", groupName)
      .maybeSingle();
    if (group) query = query.eq("group_id", group.id);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as unknown as CandidateRow[])
    .map((t) => {
      const recalls: { id: number; recalled_at: string; overall_score: number; format: string | null }[] = t.recalls ?? [];
      const qrs: { id: number; reviewed_at: string; overall_score: number }[] = t.quick_review_sessions ?? [];

      // Bug 2 fix: urgency uses only full recall dates; display uses any session date
      const sortedRecalls = [...recalls].sort((a, b) => b.recalled_at.localeCompare(a.recalled_at));
      const lastRecallDate = sortedRecalls[0]?.recalled_at ?? null;
      const daysSinceFullRecall = lastRecallDate
        ? Math.floor((Date.now() - new Date(lastRecallDate).getTime()) / 86_400_000)
        : null;

      const allDates = [
        ...recalls.map((r) => r.recalled_at),
        ...qrs.map((qr) => qr.reviewed_at),
      ].filter(Boolean).sort();
      const lastDate = allDates.at(-1) ?? null;
      const daysSince = lastDate
        ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86_400_000)
        : null;

      // Inconsistency fix: avg_score merges recall and QR overall scores (same logic as subsections)
      const allSessions = [
        ...recalls.map((r) => ({ date: r.recalled_at, score: r.overall_score })),
        ...qrs.map((q) => ({ date: q.reviewed_at, score: q.overall_score })),
      ].sort((a, b) => b.date.localeCompare(a.date));
      const recentSessions = allSessions.slice(0, RECENT_WINDOW);
      const avgScore = recentSessions.length
        ? recentSessions.reduce((s, r) => s + r.score, 0) / recentSessions.length
        : null;

      // Bug 5 fix: consolidation factor — more recalls = topic can wait longer (logarithmic growth)
      // log(0 + e) = 1 so new topics are unaffected; log grows slowly preventing over-suppression
      const consolidation = Math.log(recalls.length + Math.E);
      const urgencyDays = daysSinceFullRecall ?? daysSince ?? 0;
      const urgency =
        recalls.length === 0 && qrs.length === 0
          ? 999
          : urgencyDays / ((avgScore ?? 0) + 1) / consolidation;

      // SM-2 source + interval ladder depend on practice type:
      //  - Topics with full recalls (conceptual, e.g. Emily): unchanged ladder
      //    [3, 14, ×EF], reset 3 — directed recalls excluded (partial retention).
      //  - Topics with only quick reviews (procedural practice, e.g. Lesty's
      //    math): SM-2 is fed by quick reviews with a *dense* ladder
      //    [1, 3, 7, 16, ×EF], reset 1 — mass early, stretch once mechanized.
      // Without this, a quick-review-only topic never advances any interval and
      // scheduling degrades to pure recency (no real spaced repetition).
      const fullRecalls = recalls
        .filter((r) => (r.format ?? "completo") === "completo")
        .map((r) => ({ date: r.recalled_at, q: r.overall_score ?? 0 }));
      const useRecalls = fullRecalls.length > 0;
      const smSource = (useRecalls
        ? fullRecalls
        : qrs.map((q) => ({ date: q.reviewed_at, q: q.overall_score ?? 0 }))
      ).sort((a, b) => a.date.localeCompare(b.date));
      const ladder = useRecalls ? [3, 14] : [1, 3, 7, 16];
      const failReset = useRecalls ? 3 : 1;

      let sm2Interval = 1, sm2EF = 2.5, sm2Reps = 0;
      for (const s of smSource) {
        const q = s.q;
        if (q >= 3) {
          sm2Interval = sm2Reps < ladder.length
            ? ladder[sm2Reps]
            : Math.round(sm2Interval * sm2EF);
          sm2Reps++;
        } else {
          sm2Reps = 0;
          sm2Interval = failReset;
        }
        sm2EF = Math.max(1.3, sm2EF + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
      }
      const lastRIso = smSource.at(-1)?.date ?? null;
      const nextReviewDate = lastRIso
        ? new Date(new Date(lastRIso).getTime() + sm2Interval * 86_400_000).toISOString().slice(0, 10)
        : null;
      const todayIso = new Date().toISOString().slice(0, 10);
      const daysOverdue = nextReviewDate
        ? Math.round((Date.parse(todayIso) - Date.parse(nextReviewDate)) / 86_400_000)
        : recalls.length === 0 && qrs.length === 0 ? 999
        : recalls.length === 0 ? (daysSince ?? 30)
        : 0;

      // Maps for cross-referencing session dates in subsection calculations
      const recallDateMap = new Map(recalls.map((r) => [r.id, r.recalled_at]));
      const qrDateMap = new Map(qrs.map((q) => [q.id, q.reviewed_at]));

      const subsections = (t.topic_subsections ?? []).map((s) => {
        const rs: { recall_id: number; covered: boolean; score: number }[] = s.recall_subsections ?? [];
        const qas: { session_id: number; score: number; question: string | null }[] = s.quick_review_answers ?? [];

        // Bug 3 fix: avg_score merges recall and quick review scores, ordered by session date
        const recallEntries = rs.map((r) => ({ date: recallDateMap.get(r.recall_id) ?? "", score: r.score }));
        const qrEntries = qas.map((q) => ({ date: qrDateMap.get(q.session_id) ?? "", score: q.score }));
        const allEntries = [...recallEntries, ...qrEntries]
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-RECENT_WINDOW);

        // times_missed only from recalls — quick reviews have no "covered" concept
        const sortedRs = [...rs].sort((a, b) =>
          (recallDateMap.get(a.recall_id) ?? "").localeCompare(recallDateMap.get(b.recall_id) ?? ""),
        );
        const recentRs = sortedRs.slice(-RECENT_WINDOW);

        const avg_score = allEntries.length ? allEntries.reduce((acc, e) => acc + e.score, 0) / allEntries.length : null;
        const times_missed = recentRs.filter((r) => !r.covered).length;
        const mastered = allEntries.length >= RECENT_WINDOW && avg_score !== null && avg_score >= 4.5 && times_missed === 0;
        const recent_questions = [...qas]
          .sort((a, b) => (qrDateMap.get(b.session_id) ?? "").localeCompare(qrDateMap.get(a.session_id) ?? ""))
          .slice(0, 5)
          .map((q) => q.question)
          .filter((q): q is string => q !== null);
        return { name: s.name, avg_score, times_missed, mastered, recent_questions };
      }).sort((a, b) => (a.avg_score ?? 999) - (b.avg_score ?? 999));

      return {
        topic_id: t.id,
        topic_name: t.name,
        group_name: (t.topic_groups as unknown as { name: string } | null)?.name ?? null,
        days_since_recall: daysSince,
        days_since_full_recall: daysSinceFullRecall,
        avg_score: avgScore !== null ? Math.round(avgScore * 100) / 100 : null,
        urgency: Math.round(urgency * 100) / 100,
        total_recalls: recalls.length,
        total_sessions: recalls.length + qrs.length,
        next_review_date: nextReviewDate,
        days_overdue: daysOverdue,
        sm2_interval: sm2Interval,
        subsections,
      };
    })
    .sort((a, b) => b.days_overdue - a.days_overdue);
}

// ─── Write operations ─────────────────────────────────────────────────────────

export async function saveTopicSubsections(input: SaveTopicSubsectionsInput, userId: number) {
  const groupId = input.group_name ? await getOrCreateGroup(input.group_name, userId) : null;
  const topicId = await getOrCreateTopic(input.topic_name, groupId, userId);

  // Upsert with correct order (updates order_index on existing subsections too)
  await supabase
    .from("topic_subsections")
    .upsert(
      input.subsections.map((name, i) => ({ topic_id: topicId, name, order_index: i, user_id: userId })),
      { onConflict: "topic_id,name", ignoreDuplicates: false },
    );

  // Remove phantom subsections (not in new list, no practice history)
  const { data: existing } = await supabase
    .from("topic_subsections")
    .select("id, name")
    .eq("topic_id", topicId);

  const newNameSet = new Set(input.subsections.map((n) => n.toLowerCase()));
  const phantoms = (existing ?? []).filter((s) => !newNameSet.has(s.name.toLowerCase()));

  await Promise.all(
    phantoms.map(async (s) => {
      const [{ count: recallCount }, { count: qrCount }] = await Promise.all([
        supabase.from("recall_subsections").select("id", { count: "exact", head: true }).eq("subsection_id", s.id),
        supabase.from("quick_review_answers").select("id", { count: "exact", head: true }).eq("subsection_id", s.id),
      ]);
      if ((recallCount ?? 0) === 0 && (qrCount ?? 0) === 0) {
        await supabase.from("topic_subsections").delete().eq("id", s.id);
      }
    }),
  );

  const { data: subsections } = await supabase
    .from("topic_subsections")
    .select("*")
    .eq("topic_id", topicId)
    .order("order_index");

  return { topic_id: topicId, subsections: subsections ?? [] };
}

export async function saveRecall(input: SaveRecallInput, userId: number) {
  const groupId = input.group_name ? await getOrCreateGroup(input.group_name, userId) : null;
  const topicId = await getOrCreateTopic(input.topic_name, groupId, userId);

  const { data: recall, error: re } = await supabase
    .from("recalls")
    .insert({
      topic_id: topicId,
      user_id: userId,
      transcript: input.transcript ?? null,
      feedback: input.feedback ?? null,
      overall_score: input.overall_score,
      format: input.format ?? "completo",
      review_session_id: input.session_id ?? null,
    })
    .select("id")
    .single();
  if (re) throw re;

  const recallId = recall.id;

  // Save per-subsection results
  await Promise.all(
    input.subsections.map(async (sub) => {
      const { data: s } = await supabase
        .from("topic_subsections")
        .select("id")
        .eq("topic_id", topicId)
        .ilike("name", sub.name)
        .maybeSingle();
      if (!s) return;
      await supabase.from("recall_subsections").insert({
        recall_id: recallId,
        subsection_id: s.id,
        covered: sub.covered,
        score: sub.score,
      });
    }),
  );

  return { recall_id: recallId, topic_id: topicId };
}

export async function saveQuickReview(input: SaveQuickReviewInput, userId: number) {
  const topic = await getTopicByName(input.topic_name, userId);
  if (!topic) return { success: false as const, error: `Topic "${input.topic_name}" no encontrado` };

  const { data: session, error: se } = await supabase
    .from("quick_review_sessions")
    .insert({ topic_id: topic.id, user_id: userId, overall_score: input.overall_score, feedback: input.feedback ?? null, review_session_id: input.session_id ?? null })
    .select("id")
    .single();
  if (se) throw se;

  await Promise.all(
    input.answers.map(async (a) => {
      const { data: s } = await supabase
        .from("topic_subsections")
        .select("id")
        .eq("topic_id", topic.id)
        .ilike("name", a.subsection_name)
        .maybeSingle();
      await supabase.from("quick_review_answers").insert({
        session_id: session.id,
        subsection_id: s?.id ?? null,
        question: a.question,
        answer: a.answer,
        score: a.score,
        feedback: a.feedback ?? null,
      });
    }),
  );

  return { success: true as const, session_id: session.id, topic_id: topic.id };
}

export async function updateSubsectionName(topicName: string, oldName: string, newName: string, userId: number) {
  const topic = await getTopicByName(topicName, userId);
  if (!topic) return { success: false, error: `Topic "${topicName}" no encontrado` };

  const { data: sub } = await supabase
    .from("topic_subsections")
    .select("id")
    .eq("topic_id", topic.id)
    .ilike("name", oldName)
    .maybeSingle();

  if (!sub) return { success: false, error: `Subsección "${oldName}" no encontrada en "${topicName}"` };

  const { error } = await supabase
    .from("topic_subsections")
    .update({ name: newName })
    .eq("id", sub.id);

  if (error) return { success: false, error: error.message };
  return { success: true, updated: { topic: topicName, old_name: oldName, new_name: newName } };
}

// By-id variant for the dashboard. Subsections have no user_id, so ownership is
// verified by joining to the parent topic and checking its user_id.
export async function updateSubsectionNameById(subsectionId: number, newName: string, userId: number) {
  const trimmed = newName.trim();
  if (!trimmed) return { success: false, error: "El nombre no puede estar vacío" };

  const { data: sub } = await supabase
    .from("topic_subsections")
    .select("id, topics!inner(user_id)")
    .eq("id", subsectionId)
    .maybeSingle();

  const owner = (sub?.topics as unknown as { user_id: number } | null)?.user_id;
  if (!sub || owner !== userId) return { success: false, error: "Subsección no encontrada" };

  const { error } = await supabase
    .from("topic_subsections")
    .update({ name: trimmed })
    .eq("id", subsectionId);

  if (error) return { success: false, error: error.message };
  return { success: true, subsection_id: subsectionId, new_name: trimmed };
}

export async function updateRecallFeedback(recallId: number, feedback: string, userId: number) {
  const { data, error } = await supabase
    .from("recalls")
    .update({ feedback })
    .eq("id", recallId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: `Recall #${recallId} no encontrado` };
  return { success: true, updated_recall_id: recallId };
}

export async function updateTopicById(
  id: number,
  updates: { name?: string; description?: string | null },
  userId: number,
) {
  const patch: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    const { data: existing } = await supabase
      .from("topics")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", updates.name)
      .neq("id", id)
      .maybeSingle();
    if (existing) return { success: false, error: `Ya existe un topic llamado "${updates.name}"` };
    patch.name = updates.name;
  }

  if (updates.description !== undefined) {
    // Empty string → null so the column stays clean (no blank descriptions).
    patch.description = updates.description?.trim() ? updates.description.trim() : null;
  }

  if (Object.keys(patch).length === 0) return { success: true, topic_id: id };

  const { error } = await supabase.from("topics").update(patch).eq("id", id).eq("user_id", userId);
  if (error) return { success: false, error: error.message };
  return { success: true, topic_id: id };
}

// ─── Grupos muchos-a-muchos (Track C, solo dashboard) ─────────────────────────
//
// `topic_group_links` es la fuente de verdad del conjunto de grupos. `topics.group_id`
// se mantiene como el grupo "primario" (lo que siguen usando MCP/review/stats); el
// invariante es que, si el topic tiene algún grupo, `group_id` apunta a uno de ellos.

// Agrega (get-or-create) un grupo al topic. Si el topic no tenía primario, lo fija.
export async function addTopicGroup(topicId: number, groupName: string, userId: number) {
  const name = groupName.trim();
  if (!name) return { success: false, error: "El nombre del grupo no puede estar vacío" };

  const { data: topic } = await supabase
    .from("topics")
    .select("id, group_id")
    .eq("id", topicId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!topic) return { success: false, error: "Topic no encontrado" };

  const groupId = await getOrCreateGroup(name, userId);

  const { error: linkErr } = await supabase
    .from("topic_group_links")
    .upsert({ topic_id: topicId, group_id: groupId, user_id: userId }, { onConflict: "topic_id,group_id", ignoreDuplicates: true });
  if (linkErr) return { success: false, error: linkErr.message };

  // Si el topic no tenía grupo primario, este pasa a serlo.
  if (topic.group_id === null) {
    await supabase.from("topics").update({ group_id: groupId }).eq("id", topicId).eq("user_id", userId);
  }

  return { success: true, group: { id: groupId, name } };
}

// Quita un grupo del topic. Si era el primario, lo repunta a otro grupo restante (o null).
export async function removeTopicGroup(topicId: number, groupId: number, userId: number) {
  const { data: topic } = await supabase
    .from("topics")
    .select("id, group_id")
    .eq("id", topicId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!topic) return { success: false, error: "Topic no encontrado" };

  const { error: delErr } = await supabase
    .from("topic_group_links")
    .delete()
    .eq("topic_id", topicId)
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (delErr) return { success: false, error: delErr.message };

  // Mantener el invariante del primario.
  if (topic.group_id === groupId) {
    const { data: remaining } = await supabase
      .from("topic_group_links")
      .select("group_id")
      .eq("topic_id", topicId)
      .eq("user_id", userId)
      .order("created_at")
      .limit(1);
    const newPrimary = remaining?.[0]?.group_id ?? null;
    await supabase.from("topics").update({ group_id: newPrimary }).eq("id", topicId).eq("user_id", userId);
  }

  return { success: true };
}

export async function updateTopic(
  topicName: string,
  updates: { new_name?: string; group_name?: string | null },
  userId: number,
) {
  const topic = await getTopicByName(topicName, userId);
  if (!topic) return { success: false, error: `Topic "${topicName}" no encontrado` };

  const patch: Record<string, unknown> = {};

  if (updates.new_name !== undefined) {
    const { data: existing } = await supabase
      .from("topics")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", updates.new_name)
      .neq("id", topic.id)
      .maybeSingle();
    if (existing) return { success: false, error: `Ya existe un topic llamado "${updates.new_name}"` };
    patch.name = updates.new_name;
  }

  if (updates.group_name !== undefined) {
    patch.group_id = updates.group_name !== null
      ? await getOrCreateGroup(updates.group_name, userId)
      : null;
  }

  const { error } = await supabase.from("topics").update(patch).eq("id", topic.id).eq("user_id", userId);
  if (error) return { success: false, error: error.message };
  return { success: true, topic_id: topic.id };
}

export async function deleteRecall(recallId: number, userId: number) {
  const { data, error } = await supabase
    .from("recalls")
    .delete()
    .eq("id", recallId)
    .eq("user_id", userId)
    .select("id, topic_id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: `Recall #${recallId} no encontrado` };
  return { success: true, deleted_recall_id: recallId, topic_id: data.topic_id };
}

export async function mergeTopics(sourceName: string, targetName: string, userId: number) {
  const source = await getTopicByName(sourceName, userId);
  const target = await getTopicByName(targetName, userId);

  if (!source) return { success: false, error: `Topic origen "${sourceName}" no encontrado` };
  if (!target) return { success: false, error: `Topic destino "${targetName}" no encontrado` };
  if (source.id === target.id) return { success: false, error: "Origen y destino son el mismo topic" };

  // Move recalls
  await supabase.from("recalls").update({ topic_id: target.id }).eq("topic_id", source.id);
  await supabase.from("quick_review_sessions").update({ topic_id: target.id }).eq("topic_id", source.id);

  // Move subsections not already in target
  const { data: sourceSubs } = await supabase
    .from("topic_subsections")
    .select("name")
    .eq("topic_id", source.id)
    .order("order_index");

  const { count: targetCount } = await supabase
    .from("topic_subsections")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", target.id);

  await supabase
    .from("topic_subsections")
    .upsert(
      (sourceSubs ?? []).map((s, i) => ({
        topic_id: target.id,
        name: s.name,
        order_index: (targetCount ?? 0) + i,
        user_id: userId,
      })),
      { onConflict: "topic_id,name", ignoreDuplicates: true },
    );

  await supabase.from("topics").delete().eq("id", source.id).eq("user_id", userId);

  return { success: true, merged_into: targetName, subsections_moved: (sourceSubs ?? []).length };
}

export async function deleteTopic(topicName: string, userId: number) {
  const topic = await getTopicByName(topicName, userId);
  if (!topic) return { success: false, error: `Topic "${topicName}" no encontrado` };

  const { count } = await supabase
    .from("recalls")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topic.id);

  await supabase.from("topics").delete().eq("id", topic.id).eq("user_id", userId);

  return { success: true, deleted_topic: topicName, recalls_deleted: count ?? 0 };
}

export interface ReviewSlot {
  slot: 1 | 2 | 3 | 4;
  purpose: "most_urgent" | "persistent_failure" | "consolidation" | "full_recall" | "fallback";
  format: "quick" | "recall_dirigido" | "recall_completo";
  topic_id: number;
  topic_name: string;
  group_name: string | null;
  days_since_recall: number | null;
  days_since_full_recall: number | null;
  avg_score: number | null;
  total_recalls: number;
  target_subsection?: string;
  target_subsections?: string[];
  recent_questions?: string[];
}

// How many recent sessions slot-1 topics are excluded from slot 1 again.
// 2 means: if a topic was slot 1 in either of the last 2 sessions, skip it.
const SLOT1_COOLDOWN_SESSIONS = 2;

export interface NewTopic {
  topic_id: number;
  topic_name: string;
  group_name: string | null;
}

export async function getReviewPlan(
  userId: number,
  groupName?: string,
): Promise<{ slots: ReviewSlot[]; session_id?: number; message?: string; new_topics: NewTopic[] }> {
  const [allCandidates, { data: recentSlotRows }, settings] = await Promise.all([
    getReviewCandidates(userId, groupName),
    supabase
      .from("review_session_slots")
      .select("topic_id, slot_number, subsection_names, session_id")
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .limit(SLOT1_COOLDOWN_SESSIONS * 4 + 4), // enough rows to cover recent sessions
    getUserSettings(userId),
  ]);

  // Split off never-practiced topics so spaced repetition only schedules material
  // the user has actually seen. They're returned in `new_topics` (not the plan)
  // so Claude can offer to "estrenarlos" without polluting the review slots.
  const newTopics: NewTopic[] = settings.review_only_practiced
    ? allCandidates
        .filter((c) => c.total_sessions === 0)
        .map((c) => ({ topic_id: c.topic_id, topic_name: c.topic_name, group_name: c.group_name }))
    : [];
  const candidates = settings.review_only_practiced
    ? allCandidates.filter((c) => c.total_sessions > 0)
    : allCandidates;

  if (allCandidates.length === 0) {
    return { slots: [], new_topics: newTopics, message: "No hay topics registrados para repasar." };
  }
  if (candidates.length === 0) {
    return {
      slots: [],
      new_topics: newTopics,
      message: "Todos tus topics son nuevos: estrénalos con un primer recall o quick review antes de entrar al repaso espaciado.",
    };
  }

  // Topics that occupied slot 1 in the last SLOT1_COOLDOWN_SESSIONS sessions → cooldown
  const slot1Rows = (recentSlotRows ?? []).filter((r) => r.slot_number === 1);
  const recentSessionIds = [...new Set(slot1Rows.map((r) => r.session_id))].slice(0, SLOT1_COOLDOWN_SESSIONS);
  const cooledTopics = new Set(
    slot1Rows.filter((r) => recentSessionIds.includes(r.session_id)).map((r) => r.topic_id),
  );

  // Last subsection targeted per topic (for rotation across bottom-3)
  const lastSubByTopic = new Map<number, string>();
  for (const r of (recentSlotRows ?? [])) {
    if (!lastSubByTopic.has(r.topic_id) && r.subsection_names?.length > 0) {
      lastSubByTopic.set(r.topic_id, r.subsection_names[0]);
    }
  }

  const used = new Set<number>();

  // Picks from the bottom-3 weakest unmastered subsections, rotating away from the last one asked.
  function weakestQuickSubsection(c: ReviewCandidate): string {
    const pool = c.subsections.filter((s) => !s.mastered);
    const ranked = [...(pool.length > 0 ? pool : c.subsections)]
      .sort((a, b) => (a.avg_score ?? 0) - (b.avg_score ?? 0));
    const bottom3 = ranked.slice(0, 3);
    const lastSub = lastSubByTopic.get(c.topic_id);
    const rotated = lastSub ? (bottom3.find((s) => s.name !== lastSub) ?? bottom3[0]) : bottom3[0];
    return rotated?.name ?? "general";
  }

  function recentQuestionsFor(c: ReviewCandidate, subsectionName: string): string[] {
    return c.subsections.find((s) => s.name === subsectionName)?.recent_questions ?? [];
  }

  function weakestRecallSubsections(c: ReviewCandidate): string[] {
    return [...c.subsections]
      .filter((s) => !s.mastered)
      .filter((s) => !(s.avg_score !== null && s.avg_score >= 4.0))
      .sort((a, b) => b.times_missed - a.times_missed || (a.avg_score ?? 0) - (b.avg_score ?? 0))
      .slice(0, 3)
      .map((s) => s.name);
  }

  const slots: ReviewSlot[] = [];

  // Slot 1: más urgente por tiempo — aplica cooldown para no repetir el mismo topic sesión tras sesión
  const s1 = candidates.find((c) => !used.has(c.topic_id) && !cooledTopics.has(c.topic_id))
    ?? candidates.find((c) => !used.has(c.topic_id)); // fallback si todos están en cooldown
  if (s1) {
    used.add(s1.topic_id);
    const s1Target = weakestQuickSubsection(s1);
    slots.push({
      slot: 1, purpose: "most_urgent", format: "quick",
      topic_id: s1.topic_id, topic_name: s1.topic_name, group_name: s1.group_name,
      days_since_recall: s1.days_since_recall, days_since_full_recall: s1.days_since_full_recall,
      avg_score: s1.avg_score, total_recalls: s1.total_recalls,
      target_subsection: s1Target,
      recent_questions: recentQuestionsFor(s1, s1Target),
    });
  }

  // Slot 2: misses persistentes en recalls Y avg_score bajo (incluye QRs) → recall dirigido
  const s2 = candidates.find((c) => !used.has(c.topic_id) && c.subsections.some((s) => s.times_missed >= 2 && (s.avg_score ?? 0) < 4.0));
  if (s2) {
    used.add(s2.topic_id);
    slots.push({
      slot: 2, purpose: "persistent_failure", format: "recall_dirigido",
      topic_id: s2.topic_id, topic_name: s2.topic_name, group_name: s2.group_name,
      days_since_recall: s2.days_since_recall, days_since_full_recall: s2.days_since_full_recall,
      avg_score: s2.avg_score, total_recalls: s2.total_recalls,
      target_subsections: weakestRecallSubsections(s2),
    });
  } else {
    const fallback = candidates.find((c) => !used.has(c.topic_id));
    if (fallback) {
      used.add(fallback.topic_id);
      const fbTarget = weakestQuickSubsection(fallback);
      slots.push({
        slot: 2, purpose: "fallback", format: "quick",
        topic_id: fallback.topic_id, topic_name: fallback.topic_name, group_name: fallback.group_name,
        days_since_recall: fallback.days_since_recall, days_since_full_recall: fallback.days_since_full_recall,
        avg_score: fallback.avg_score, total_recalls: fallback.total_recalls,
        target_subsection: fbTarget,
        recent_questions: recentQuestionsFor(fallback, fbTarget),
      });
    }
  }

  // Slot 3: consolidación (practicado ≥3 veces, bien aprendido, sin tocar ≥7 días)
  const s3 = candidates.find((c) =>
    !used.has(c.topic_id) &&
    c.total_recalls >= 1 &&
    c.avg_score !== null && c.avg_score >= 3.5 &&
    c.days_since_recall !== null && c.days_since_recall >= 7,
  );
  if (s3) {
    used.add(s3.topic_id);
    const s3Target = weakestQuickSubsection(s3);
    slots.push({
      slot: 3, purpose: "consolidation", format: "quick",
      topic_id: s3.topic_id, topic_name: s3.topic_name, group_name: s3.group_name,
      days_since_recall: s3.days_since_recall, days_since_full_recall: s3.days_since_full_recall,
      avg_score: s3.avg_score, total_recalls: s3.total_recalls,
      target_subsection: s3Target,
      recent_questions: recentQuestionsFor(s3, s3Target),
    });
  } else {
    const fallback = candidates.find((c) => !used.has(c.topic_id));
    if (fallback) {
      used.add(fallback.topic_id);
      const fbTarget = weakestQuickSubsection(fallback);
      slots.push({
        slot: 3, purpose: "fallback", format: "quick",
        topic_id: fallback.topic_id, topic_name: fallback.topic_name, group_name: fallback.group_name,
        days_since_recall: fallback.days_since_recall, days_since_full_recall: fallback.days_since_full_recall,
        avg_score: fallback.avg_score, total_recalls: fallback.total_recalls,
        target_subsection: fbTarget,
        recent_questions: recentQuestionsFor(fallback, fbTarget),
      });
    }
  }

  // Slot 4: recall completo — el topic con más días sin recall completo (≥1 recall previo)
  // Sorted by days_since_full_recall desc (null = nunca → máxima prioridad)
  const fullRecallPool = candidates
    .filter((c) => !used.has(c.topic_id) && c.total_recalls >= 1)
    .sort((a, b) => (b.days_since_full_recall ?? Infinity) - (a.days_since_full_recall ?? Infinity));
  const s4 = fullRecallPool[0] ?? candidates.find((c) => !used.has(c.topic_id));
  if (s4) {
    used.add(s4.topic_id);
    slots.push({
      slot: 4, purpose: "full_recall", format: "recall_completo",
      topic_id: s4.topic_id, topic_name: s4.topic_name, group_name: s4.group_name,
      days_since_recall: s4.days_since_recall, days_since_full_recall: s4.days_since_full_recall,
      avg_score: s4.avg_score, total_recalls: s4.total_recalls,
    });
  }

  // Persist the session for traceability and future cooldown calculations
  let session_id: number | undefined;
  try {
    const { data: session, error: se } = await supabase
      .from("review_sessions")
      .insert({ group_name: groupName ?? null, user_id: userId })
      .select("id")
      .single();
    if (!se && session) {
      session_id = session.id;
      await supabase.from("review_session_slots").insert(
        slots.map((slot) => ({
          session_id: session.id,
          user_id: userId,
          slot_number: slot.slot,
          topic_id: slot.topic_id,
          format: slot.format,
          subsection_names: slot.target_subsection
            ? [slot.target_subsection]
            : (slot.target_subsections ?? []),
        })),
      );
    }
  } catch {
    // Session persistence is best-effort — don't fail the plan if it errors
  }

  return { slots, session_id, new_topics: newTopics };
}

export async function getStats(userId: number): Promise<Stats> {
  const [
    { data: topics },
    { data: recalls },
    { data: qrs },
  ] = await Promise.all([
    supabase.from("topics").select("id, topic_groups!topics_group_id_fkey(name)").eq("user_id", userId),
    supabase.from("recalls").select("topic_id, recalled_at, overall_score").eq("user_id", userId),
    supabase.from("quick_review_sessions").select("topic_id, reviewed_at").eq("user_id", userId),
  ]);

  const totalTopics = topics?.length ?? 0;
  const totalRecalls = recalls?.length ?? 0;
  const totalQRs = qrs?.length ?? 0;

  // Last score per topic (used for both avg and below-3 count)
  const lastScoreByTopic = new Map<number, number>();
  for (const r of [...(recalls ?? [])].sort((a, b) => b.recalled_at.localeCompare(a.recalled_at))) {
    if (!lastScoreByTopic.has(r.topic_id) && r.overall_score !== null)
      lastScoreByTopic.set(r.topic_id, r.overall_score);
  }

  // getStats fix: avg_score = average of each topic's current score, not all-time history
  const currentScores = [...lastScoreByTopic.values()];
  const avgScore = currentScores.length
    ? Math.round(currentScores.reduce((s, v) => s + v, 0) / currentScores.length * 100) / 100
    : null;

  const topicsBelow3 = currentScores.filter((s) => s < 3.0).length;

  // Topics sin ninguna sesión
  const sessionedIds = new Set([
    ...(recalls ?? []).map((r) => r.topic_id),
    ...(qrs ?? []).map((q) => q.topic_id),
  ]);
  const topicsNeverRecalled = (topics ?? []).filter((t) => !sessionedIds.has(t.id)).length;

  // Racha de días consecutivos hasta hoy (fechas locales, no UTC)
  const localDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const allDays = new Set([
    ...(recalls ?? []).map((r) => localDate(new Date(r.recalled_at))),
    ...(qrs ?? []).map((q) => localDate(new Date(q.reviewed_at))),
  ]);
  let streak = 0;
  const cur = new Date();
  while (allDays.has(localDate(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }

  // Última sesión
  const allDates = [
    ...(recalls ?? []).map((r) => r.recalled_at),
    ...(qrs ?? []).map((q) => q.reviewed_at),
  ].sort().reverse();
  const lastSessionDate = allDates[0]?.slice(0, 10) ?? null;

  // Grupo más activo (por número de recalls)
  const groupCounts = new Map<string, number>();
  for (const r of (recalls ?? [])) {
    const topic = (topics ?? []).find((t) => t.id === r.topic_id);
    const g = (topic?.topic_groups as unknown as { name: string } | null)?.name;
    if (g) groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);
  }
  const mostActiveGroup = [...groupCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    total_topics: totalTopics,
    total_recalls: totalRecalls,
    total_quick_reviews: totalQRs,
    avg_score: avgScore,
    topics_below_3: topicsBelow3,
    topics_never_recalled: topicsNeverRecalled,
    study_streak_days: streak,
    last_session_date: lastSessionDate,
    most_active_group: mostActiveGroup,
  };
}
