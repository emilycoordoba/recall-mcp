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
  avg_score: number | null;
  urgency: number;
  total_recalls: number;
  subsections: { name: string; avg_score: number | null; times_missed: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOrCreateGroup(name: string): Promise<number> {
  const { data: existing } = await supabase
    .from("topic_groups")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("topic_groups")
    .insert({ name })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function getOrCreateTopic(name: string, groupId: number | null): Promise<number> {
  const { data: existing } = await supabase
    .from("topics")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("topics")
    .insert({ name, group_id: groupId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// ─── Read operations ──────────────────────────────────────────────────────────

export async function findTopics(query: string) {
  const [{ data: topicData, error: te }, { data: subsData, error: se }] = await Promise.all([
    supabase
      .from("topics")
      .select("id, name, group_id, topic_groups(name)")
      .ilike("name", `%${query}%`)
      .order("name"),
    supabase
      .from("topic_subsections")
      .select("name, topic_id, topics(id, name, group_id, topic_groups(name))")
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
      group_name: (t.topic_groups as { name: string } | null)?.name ?? null,
      match_type: "topic",
      matched_subsections: [],
    });
  }

  for (const s of subsData ?? []) {
    const parent = s.topics as { id: number; name: string; group_id: number | null; topic_groups: { name: string } | null } | null;
    if (!parent) continue;
    const existing = map.get(parent.id);
    if (existing) {
      existing.match_type = "both";
      existing.matched_subsections.push(s.name);
    } else {
      map.set(parent.id, {
        id: parent.id,
        name: parent.name,
        group_name: (parent.topic_groups as { name: string } | null)?.name ?? null,
        match_type: "subsection",
        matched_subsections: [s.name],
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTopicByName(name: string) {
  const { data, error } = await supabase
    .from("topics")
    .select("id, name, group_id, topic_groups(name)")
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    group_name: (data.topic_groups as { name: string } | null)?.name ?? null,
  };
}

export async function getTopicHistory(topicId: number) {
  const { data: topic, error: te } = await supabase
    .from("topics")
    .select("id, name")
    .eq("id", topicId)
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
          subsection_name: (s.topic_subsections as { name: string } | null)?.name ?? "",
          topic_subsections: undefined,
        })),
      };
    }),
  );

  return { ...topic, subsections: subsections ?? [], recalls: recallsWithSubs };
}

export async function listTopics(groupName?: string) {
  let query = supabase
    .from("topics")
    .select(`id, name, created_at, group_id, topic_groups(name), recalls(overall_score, recalled_at)`)
    .order("name");

  if (groupName) {
    const { data: group } = await supabase
      .from("topic_groups")
      .select("id")
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
      group_name: (t.topic_groups as { name: string } | null)?.name ?? null,
      last_score: sorted[0]?.overall_score ?? null,
      last_recall: sorted[0]?.recalled_at ?? null,
      total_recalls: recalls.length,
    };
  });
}

export async function filterTopics(
  sortBy: "score_asc" | "score_desc" | "date_asc" | "date_desc" | "name",
  groupName?: string,
) {
  const rows = await listTopics(groupName);

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

export async function getReviewCandidates(groupName?: string): Promise<ReviewCandidate[]> {
  let query = supabase
    .from("topics")
    .select(`
      id, name,
      topic_groups(name),
      recalls(id, recalled_at, overall_score),
      quick_review_sessions(id, reviewed_at),
      topic_subsections(
        id, name,
        recall_subsections(recall_id, covered, score),
        quick_review_answers(session_id, score)
      )
    `)
    .order("name");

  if (groupName) {
    const { data: group } = await supabase
      .from("topic_groups")
      .select("id")
      .ilike("name", groupName)
      .maybeSingle();
    if (group) query = query.eq("group_id", group.id);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as any[])
    .map((t) => {
      const recalls: { id: number; recalled_at: string; overall_score: number }[] = t.recalls ?? [];
      const qrs: { id: number; reviewed_at: string }[] = t.quick_review_sessions ?? [];

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

      // Bug 1 fix: avg_score uses only the last RECENT_WINDOW full recalls
      const recentRecalls = sortedRecalls.slice(0, RECENT_WINDOW);
      const avgScore = recentRecalls.length
        ? recentRecalls.reduce((s, r) => s + r.overall_score, 0) / recentRecalls.length
        : null;

      // Bug 5 fix: consolidation factor — more recalls = topic can wait longer (logarithmic growth)
      // log(0 + e) = 1 so new topics are unaffected; log grows slowly preventing over-suppression
      const consolidation = Math.log(recalls.length + Math.E);
      const urgencyDays = daysSinceFullRecall ?? daysSince ?? 0;
      const urgency =
        recalls.length === 0 && qrs.length === 0
          ? 999
          : urgencyDays / ((avgScore ?? 0) + 1) / consolidation;

      // Maps for cross-referencing session dates in subsection calculations
      const recallDateMap = new Map(recalls.map((r) => [r.id, r.recalled_at]));
      const qrDateMap = new Map(qrs.map((q) => [q.id, q.reviewed_at]));

      const subsections = ((t.topic_subsections ?? []) as any[]).map((s) => {
        const rs: { recall_id: number; covered: boolean; score: number }[] = s.recall_subsections ?? [];
        const qas: { session_id: number; score: number }[] = s.quick_review_answers ?? [];

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

        return {
          name: s.name,
          avg_score: allEntries.length ? allEntries.reduce((acc, e) => acc + e.score, 0) / allEntries.length : null,
          times_missed: recentRs.filter((r) => !r.covered).length,
        };
      }).sort((a, b) => (a.avg_score ?? 999) - (b.avg_score ?? 999));

      return {
        topic_id: t.id,
        topic_name: t.name,
        group_name: (t.topic_groups as { name: string } | null)?.name ?? null,
        days_since_recall: daysSince,
        avg_score: avgScore !== null ? Math.round(avgScore * 100) / 100 : null,
        urgency: Math.round(urgency * 100) / 100,
        total_recalls: recalls.length,
        subsections,
      };
    })
    .sort((a, b) => b.urgency - a.urgency);
}

// ─── Write operations ─────────────────────────────────────────────────────────

export async function saveTopicSubsections(input: SaveTopicSubsectionsInput) {
  const groupId = input.group_name ? await getOrCreateGroup(input.group_name) : null;
  const topicId = await getOrCreateTopic(input.topic_name, groupId);

  const { count } = await supabase
    .from("topic_subsections")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topicId);

  const existingCount = count ?? 0;

  await supabase
    .from("topic_subsections")
    .upsert(
      input.subsections.map((name, i) => ({
        topic_id: topicId,
        name,
        order_index: existingCount + i,
      })),
      { onConflict: "topic_id,name", ignoreDuplicates: true },
    );

  const { data: subsections } = await supabase
    .from("topic_subsections")
    .select("*")
    .eq("topic_id", topicId)
    .order("order_index");

  return { topic_id: topicId, subsections: subsections ?? [] };
}

export async function saveRecall(input: SaveRecallInput) {
  const groupId = input.group_name ? await getOrCreateGroup(input.group_name) : null;
  const topicId = await getOrCreateTopic(input.topic_name, groupId);

  // Add any new subsections
  const { count } = await supabase
    .from("topic_subsections")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topicId);

  await supabase
    .from("topic_subsections")
    .upsert(
      input.subsections.map((s, i) => ({
        topic_id: topicId,
        name: s.name,
        order_index: (count ?? 0) + i,
      })),
      { onConflict: "topic_id,name", ignoreDuplicates: true },
    );

  const { data: recall, error: re } = await supabase
    .from("recalls")
    .insert({
      topic_id: topicId,
      transcript: input.transcript ?? null,
      feedback: input.feedback ?? null,
      overall_score: input.overall_score,
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

export async function saveQuickReview(input: SaveQuickReviewInput) {
  const topic = await getTopicByName(input.topic_name);
  if (!topic) return { success: false as const, error: `Topic "${input.topic_name}" no encontrado` };

  const { data: session, error: se } = await supabase
    .from("quick_review_sessions")
    .insert({ topic_id: topic.id, overall_score: input.overall_score, feedback: input.feedback ?? null })
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

export async function updateSubsectionName(topicName: string, oldName: string, newName: string) {
  const topic = await getTopicByName(topicName);
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

export async function updateRecallFeedback(recallId: number, feedback: string) {
  const { data, error } = await supabase
    .from("recalls")
    .update({ feedback })
    .eq("id", recallId)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: `Recall #${recallId} no encontrado` };
  return { success: true, updated_recall_id: recallId };
}

export async function updateTopic(
  topicName: string,
  updates: { new_name?: string; group_name?: string | null },
) {
  const topic = await getTopicByName(topicName);
  if (!topic) return { success: false, error: `Topic "${topicName}" no encontrado` };

  const patch: Record<string, unknown> = {};

  if (updates.new_name !== undefined) {
    const { data: existing } = await supabase
      .from("topics")
      .select("id")
      .ilike("name", updates.new_name)
      .neq("id", topic.id)
      .maybeSingle();
    if (existing) return { success: false, error: `Ya existe un topic llamado "${updates.new_name}"` };
    patch.name = updates.new_name;
  }

  if (updates.group_name !== undefined) {
    patch.group_id = updates.group_name !== null
      ? await getOrCreateGroup(updates.group_name)
      : null;
  }

  const { error } = await supabase.from("topics").update(patch).eq("id", topic.id);
  if (error) return { success: false, error: error.message };
  return { success: true, topic_id: topic.id };
}

export async function deleteRecall(recallId: number) {
  const { data, error } = await supabase
    .from("recalls")
    .delete()
    .eq("id", recallId)
    .select("id, topic_id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: `Recall #${recallId} no encontrado` };
  return { success: true, deleted_recall_id: recallId, topic_id: data.topic_id };
}

export async function mergeTopics(sourceName: string, targetName: string) {
  const source = await getTopicByName(sourceName);
  const target = await getTopicByName(targetName);

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
      })),
      { onConflict: "topic_id,name", ignoreDuplicates: true },
    );

  await supabase.from("topics").delete().eq("id", source.id);

  return { success: true, merged_into: targetName, subsections_moved: (sourceSubs ?? []).length };
}

export async function deleteTopic(topicName: string) {
  const topic = await getTopicByName(topicName);
  if (!topic) return { success: false, error: `Topic "${topicName}" no encontrado` };

  const { count } = await supabase
    .from("recalls")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topic.id);

  await supabase.from("topics").delete().eq("id", topic.id);

  return { success: true, deleted_topic: topicName, recalls_deleted: count ?? 0 };
}

export interface ReviewSlot {
  slot: 1 | 2 | 3;
  purpose: "most_urgent" | "persistent_failure" | "consolidation" | "fallback";
  format: "quick" | "recall_dirigido";
  topic_id: number;
  topic_name: string;
  group_name: string | null;
  days_since_recall: number | null;
  avg_score: number | null;
  target_subsection?: string;
  target_subsections?: string[];
}

export async function getReviewPlan(groupName?: string): Promise<{ slots: ReviewSlot[]; message?: string }> {
  const candidates = await getReviewCandidates(groupName);
  if (candidates.length === 0) return { slots: [], message: "No hay topics registrados para repasar." };

  const used = new Set<number>();

  function weakestQuickSubsection(c: ReviewCandidate): string {
    const ranked = [...c.subsections].sort((a, b) => (a.avg_score ?? 0) - (b.avg_score ?? 0));
    return ranked[0]?.name ?? "general";
  }

  function weakestRecallSubsections(c: ReviewCandidate): string[] {
    return [...c.subsections]
      .filter((s) => !(s.avg_score !== null && s.avg_score >= 4.0 && s.times_missed === 0))
      .sort((a, b) => b.times_missed - a.times_missed || (a.avg_score ?? 0) - (b.avg_score ?? 0))
      .slice(0, 3)
      .map((s) => s.name);
  }

  const slots: ReviewSlot[] = [];

  // Slot 1: más urgente por tiempo
  const s1 = candidates.find((c) => !used.has(c.topic_id));
  if (s1) {
    used.add(s1.topic_id);
    slots.push({
      slot: 1, purpose: "most_urgent", format: "quick",
      topic_id: s1.topic_id, topic_name: s1.topic_name, group_name: s1.group_name,
      days_since_recall: s1.days_since_recall, avg_score: s1.avg_score,
      target_subsection: weakestQuickSubsection(s1),
    });
  }

  // Slot 2: subsección más fallada (times_missed >= 2) → recall dirigido
  const s2 = candidates.find((c) => !used.has(c.topic_id) && c.subsections.some((s) => s.times_missed >= 2));
  if (s2) {
    used.add(s2.topic_id);
    slots.push({
      slot: 2, purpose: "persistent_failure", format: "recall_dirigido",
      topic_id: s2.topic_id, topic_name: s2.topic_name, group_name: s2.group_name,
      days_since_recall: s2.days_since_recall, avg_score: s2.avg_score,
      target_subsections: weakestRecallSubsections(s2),
    });
  } else {
    const fallback = candidates.find((c) => !used.has(c.topic_id));
    if (fallback) {
      used.add(fallback.topic_id);
      slots.push({
        slot: 2, purpose: "fallback", format: "quick",
        topic_id: fallback.topic_id, topic_name: fallback.topic_name, group_name: fallback.group_name,
        days_since_recall: fallback.days_since_recall, avg_score: fallback.avg_score,
        target_subsection: weakestQuickSubsection(fallback),
      });
    }
  }

  // Slot 3: consolidación (bien aprendido pero sin tocar ≥7 días)
  const s3 = candidates.find((c) =>
    !used.has(c.topic_id) &&
    c.avg_score !== null && c.avg_score >= 3.5 &&
    c.days_since_recall !== null && c.days_since_recall >= 7,
  );
  if (s3) {
    used.add(s3.topic_id);
    slots.push({
      slot: 3, purpose: "consolidation", format: "quick",
      topic_id: s3.topic_id, topic_name: s3.topic_name, group_name: s3.group_name,
      days_since_recall: s3.days_since_recall, avg_score: s3.avg_score,
      target_subsection: weakestQuickSubsection(s3),
    });
  } else {
    const fallback = candidates.find((c) => !used.has(c.topic_id));
    if (fallback) {
      used.add(fallback.topic_id);
      slots.push({
        slot: 3, purpose: "fallback", format: "quick",
        topic_id: fallback.topic_id, topic_name: fallback.topic_name, group_name: fallback.group_name,
        days_since_recall: fallback.days_since_recall, avg_score: fallback.avg_score,
        target_subsection: weakestQuickSubsection(fallback),
      });
    }
  }

  return { slots };
}

export async function getStats(): Promise<Stats> {
  const [
    { data: topics },
    { data: recalls },
    { data: qrs },
  ] = await Promise.all([
    supabase.from("topics").select("id, topic_groups(name)"),
    supabase.from("recalls").select("topic_id, recalled_at, overall_score"),
    supabase.from("quick_review_sessions").select("topic_id, reviewed_at"),
  ]);

  const totalTopics = topics?.length ?? 0;
  const totalRecalls = recalls?.length ?? 0;
  const totalQRs = qrs?.length ?? 0;

  // Promedio global de scores
  const scored = (recalls ?? []).filter((r) => r.overall_score !== null);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, r) => s + r.overall_score!, 0) / scored.length * 100) / 100
    : null;

  // Último score por topic → cuántos están bajo 3.0
  const lastScoreByTopic = new Map<number, number>();
  for (const r of [...(recalls ?? [])].sort((a, b) => b.recalled_at.localeCompare(a.recalled_at))) {
    if (!lastScoreByTopic.has(r.topic_id) && r.overall_score !== null)
      lastScoreByTopic.set(r.topic_id, r.overall_score);
  }
  const topicsBelow3 = [...lastScoreByTopic.values()].filter((s) => s < 3.0).length;

  // Topics sin ninguna sesión
  const sessionedIds = new Set([
    ...(recalls ?? []).map((r) => r.topic_id),
    ...(qrs ?? []).map((q) => q.topic_id),
  ]);
  const topicsNeverRecalled = (topics ?? []).filter((t) => !sessionedIds.has(t.id)).length;

  // Racha de días consecutivos hasta hoy
  const allDays = new Set([
    ...(recalls ?? []).map((r) => r.recalled_at.slice(0, 10)),
    ...(qrs ?? []).map((q) => q.reviewed_at.slice(0, 10)),
  ]);
  let streak = 0;
  const cur = new Date();
  while (allDays.has(cur.toISOString().slice(0, 10))) {
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
    const g = (topic?.topic_groups as { name: string } | null)?.name;
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
