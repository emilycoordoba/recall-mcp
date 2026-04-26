import { notFound } from "next/navigation"
import { getTopic, getSubsectionStats, getRecalls, getRecallSubsections, getQuickReviews, getQuickReviewAnswers } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BackButton } from "@/components/back-button"
import { TopicSessions } from "@/components/topic-sessions"

export const revalidate = 30

export default async function TopicPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const topicId = parseInt(id, 10)
  if (isNaN(topicId)) notFound()

  const [topic, subsections, rawRecalls, rawQuickReviews] = await Promise.all([
    getTopic(topicId),
    getSubsectionStats(topicId),
    getRecalls(topicId),
    getQuickReviews(topicId),
  ])
  if (!topic) notFound()

  const recalls = await Promise.all(
    rawRecalls.map(async (recall) => ({
      type: "recall" as const,
      date: recall.recalled_at,
      data: { ...recall, subsections: await getRecallSubsections(recall.id) },
    })),
  )

  const quickReviews = await Promise.all(
    rawQuickReviews.map(async (qr) => ({
      type: "quick" as const,
      date: qr.reviewed_at,
      data: { ...qr, answers: await getQuickReviewAnswers(qr.id) },
    })),
  )

  const sessions = [...recalls, ...quickReviews].sort((a, b) =>
    b.date.localeCompare(a.date)
  )

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <BackButton />

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{topic.name}</h1>
          {topic.group_name && (
            <Badge variant="outline">{topic.group_name}</Badge>
          )}
        </div>
        {topic.description && (
          <p className="mt-2 text-sm text-muted-foreground">{topic.description}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {recalls.length} recall{recalls.length !== 1 ? "s" : ""} · {quickReviews.length} quick review{quickReviews.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Subsections */}
      {subsections.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Subsections</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1">
              {subsections.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-right font-mono text-xs text-muted-foreground">
                    {i + 1}.
                  </span>
                  <span className="flex-1">{s.name}</span>
                  {s.practice_count > 0 && (
                    <span className="font-mono text-xs text-muted-foreground">
                      ×{s.practice_count}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <TopicSessions sessions={sessions} subsections={subsections} />
    </div>
  )
}
