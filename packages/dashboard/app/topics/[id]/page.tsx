import Link from "next/link"
import { notFound } from "next/navigation"
import { getTopic, getSubsections, getRecalls, getRecallSubsections } from "@/lib/db"
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
import { IconArrowLeft, IconCheck, IconX } from "@tabler/icons-react"

function formatDate(iso: string) {
  return new Date(iso + "Z").toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">—</span>
  const variant =
    score >= 4.0 ? "default" : score >= 3.0 ? "secondary" : "destructive"
  return <Badge variant={variant}>{score.toFixed(1)}</Badge>
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const topicId = parseInt(id, 10)
  if (isNaN(topicId)) notFound()

  const topic = getTopic(topicId)
  if (!topic) notFound()

  const subsections = getSubsections(topicId)
  const recalls = getRecalls(topicId).map((recall) => ({
    ...recall,
    subsections: getRecallSubsections(recall.id),
  }))

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Back */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

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
          {recalls.length} recall{recalls.length !== 1 ? "s" : ""}
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

      {/* Recall history */}
      <h2 className="mb-4 text-base font-medium">Recall History</h2>

      {recalls.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recalls yet.</p>
      ) : (
        <div className="space-y-6">
          {recalls.map((recall) => (
            <Card key={recall.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(recall.recalled_at)}
                  </span>
                  <ScoreBadge score={recall.overall_score} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Subsection breakdown */}
                {recall.subsections.length > 0 && (
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
                        {recall.subsections.map((rs) => (
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

                {/* Transcript */}
                {recall.transcript && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Transcript
                    </p>
                    <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-4 py-3 text-sm leading-relaxed">
                      {recall.transcript}
                    </p>
                  </div>
                )}

                {/* Feedback */}
                {recall.feedback && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Feedback
                    </p>
                    <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-4 py-3 text-sm leading-relaxed">
                      {recall.feedback}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
