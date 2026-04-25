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
  const { data, error } = await supabase
    .from("topics")
    .select("id, name, group_id, topic_groups(name)")
    .ilike("name", `%${query}%`)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((t) => ({
    ...t,
    group_name: (t.topic_groups as { name: string } | null)?.name ?? null,
    topic_groups: undefined,
  }));
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

export async function getReviewCandidates(groupName?: string): Promise<ReviewCandidate[]> {
  let query = supabase
    .from("topics")
    .select(`
      id, name,
      topic_groups(name),
      recalls(recalled_at, overall_score),
      quick_review_sessions(reviewed_at),
      topic_subsections(
        id, name,
        recall_subsections(covered, score)
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
      const recalls: { recalled_at: string; overall_score: number }[] = t.recalls ?? [];
      const qrs: { reviewed_at: string }[] = t.quick_review_sessions ?? [];

      const allDates = [
        ...recalls.map((r) => r.recalled_at),
        ...qrs.map((qr) => qr.reviewed_at),
      ].filter(Boolean).sort();

      const lastDate = allDates.at(-1) ?? null;
      const daysSince = lastDate
        ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86_400_000)
        : null;

      const avgScore = recalls.length
        ? recalls.reduce((s, r) => s + r.overall_score, 0) / recalls.length
        : null;

      const urgency =
        recalls.length === 0 && qrs.length === 0
          ? 999
          : (daysSince ?? 0) / ((avgScore ?? 0) + 1);

      const subsections = ((t.topic_subsections ?? []) as any[]).map((s) => {
        const rs: { covered: boolean; score: number }[] = s.recall_subsections ?? [];
        return {
          name: s.name,
          avg_score: rs.length ? rs.reduce((acc, r) => acc + r.score, 0) / rs.length : null,
          times_missed: rs.filter((r) => !r.covered).length,
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
