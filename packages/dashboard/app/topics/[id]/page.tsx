import { notFound } from "next/navigation"
import { getTopic, getSubsections, getRecalls, getRecallSubsections, getQuickReviews, getQuickReviewAnswers } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { IconCheck, IconX, IconBolt } from "@tabler/icons-react"
import { BackButton } from "@/components/back-button"

export const revalidate = 30

function formatDate(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">—</span>
  if (score >= 4.0)
    return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-transparent">{score.toFixed(1)}</Badge>
  if (score >= 3.0)
    return <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-transparent">{score.toFixed(1)}</Badge>
  return <Badge variant="destructive">{score.toFixed(1)}</Badge>
}

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
    getSubsections(topicId),
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
                  {s.name}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Session history */}
      <h2 className="mb-4 text-base font-medium">Session History</h2>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sessions yet.</p>
      ) : (
        <div className="space-y-6">
          {sessions.map((session) =>
            session.type === "recall" ? (
              <Card key={`recall-${session.data.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatDate(session.date)}</span>
                      <Badge variant="outline" className="text-xs">Full recall</Badge>
                    </div>
                    <ScoreBadge score={session.data.overall_score} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {session.data.subsections.length > 0 && (
                    <div className="overflow-hidden rounded-md ring-1 ring-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subsection</TableHead>
                            <TableHead className="text-center w-20">Covered</TableHead>
                            <TableHead className="text-right w-20">Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {session.data.subsections.map((rs) => (
                            <TableRow key={rs.subsection_id}>
                              <TableCell className="text-sm">{rs.subsection_name}</TableCell>
                              <TableCell className="text-center">
                                {rs.covered ? (
                                  <IconCheck className="mx-auto h-4 w-4 text-green-500" />
                                ) : (
                                  <IconX className="mx-auto h-4 w-4 text-destructive" />
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <ScoreBadge score={rs.score} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {session.data.transcript && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Transcript</p>
                      <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-4 py-3 text-sm leading-relaxed">
                        {session.data.transcript}
                      </p>
                    </div>
                  )}
                  {session.data.feedback && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Feedback</p>
                      <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-4 py-3 text-sm leading-relaxed">
                        {session.data.feedback}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card key={`quick-${session.data.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatDate(session.date)}</span>
                      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                        <IconBolt className="h-3 w-3" />
                        Quick review
                      </Badge>
                    </div>
                    <ScoreBadge score={session.data.overall_score} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {session.data.answers.map((a, i) => (
                      <div key={a.id} className="rounded-md bg-muted/30 px-4 py-3 text-sm space-y-1">
                        <div className="flex items-start justify-between gap-4">
                          <p className="font-medium text-foreground leading-snug">
                            {i + 1}. {a.question}
                          </p>
                          <ScoreBadge score={a.score} />
                        </div>
                        {a.subsection_name && (
                          <p className="text-xs text-muted-foreground">↳ {a.subsection_name}</p>
                        )}
                        {a.answer && (
                          <p className="text-muted-foreground leading-relaxed pt-1">{a.answer}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  )
}
