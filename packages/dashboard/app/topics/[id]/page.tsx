import { notFound } from "next/navigation"
import { getTopic, getSubsectionStats, getRecalls, getRecallSubsections, getQuickReviews, getQuickReviewAnswers, getGroups } from "@/lib/db"
import { suggestDifficulty } from "@/lib/difficulty"
import { currentUserId } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BackButton } from "@/components/back-button"
import { TopicSessions } from "@/components/topic-sessions"
import { TopicDetailHeader } from "@/components/topic-detail-header"
import { SubsectionList } from "@/components/subsection-list"

export const revalidate = 30

export default async function TopicPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const topicId = parseInt(id, 10)
  if (isNaN(topicId)) notFound()

  const userId = await currentUserId()
  const [topic, subsections, rawRecalls, rawQuickReviews, allGroups] = await Promise.all([
    getTopic(topicId, userId),
    getSubsectionStats(topicId, userId),
    getRecalls(topicId, userId),
    getQuickReviews(topicId, userId),
    getGroups(userId),
  ])
  if (!topic) notFound()

  const recalls = await Promise.all(
    rawRecalls.map(async (recall) => ({
      type: "recall" as const,
      date: recall.recalled_at,
      data: { ...recall, subsections: await getRecallSubsections(recall.id, userId) },
    })),
  )

  const quickReviews = await Promise.all(
    rawQuickReviews.map(async (qr) => ({
      type: "quick" as const,
      date: qr.reviewed_at,
      data: { ...qr, answers: await getQuickReviewAnswers(qr.id, userId) },
    })),
  )

  const sessions = [...recalls, ...quickReviews].sort((a, b) =>
    b.date.localeCompare(a.date)
  )

  // Difficulty only applies to procedural practice (math): quick-review-only topics.
  // rawQuickReviews is already newest-first (reviewed_at desc).
  const isProcedural = recalls.length === 0 && quickReviews.length > 0
  const difficulty = isProcedural
    ? suggestDifficulty(rawQuickReviews.map((q) => ({ score: q.overall_score ?? 0, difficulty: q.difficulty })))
    : undefined

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <BackButton />

      <TopicDetailHeader
        topic={{ id: topic.id, name: topic.name, description: topic.description, groups: topic.groups }}
        allGroups={allGroups}
        recallCount={recalls.length}
        quickReviewCount={quickReviews.length}
        difficulty={difficulty}
      />

      {/* Subsecciones */}
      {subsections.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Subsecciones</CardTitle>
          </CardHeader>
          <CardContent>
            <SubsectionList subsections={subsections} />
          </CardContent>
        </Card>
      )}

      <TopicSessions sessions={sessions} subsections={subsections} />
    </div>
  )
}
