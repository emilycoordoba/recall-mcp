"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { IconCheck, IconX, IconBolt } from "@tabler/icons-react"

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

interface RecallSubsection {
  subsection_id: number
  subsection_name: string
  covered: boolean
  score: number | null
}

interface QuickAnswer {
  id: number
  subsection_name: string | null
  question: string
  answer: string | null
  score: number | null
  feedback: string | null
}

interface RecallSession {
  type: "recall"
  date: string
  data: {
    id: number
    overall_score: number | null
    transcript: string | null
    feedback: string | null
    subsections: RecallSubsection[]
  }
}

interface QuickSession {
  type: "quick"
  date: string
  data: {
    id: number
    overall_score: number | null
    feedback: string | null
    answers: QuickAnswer[]
  }
}

type Session = RecallSession | QuickSession

interface Props {
  sessions: Session[]
  subsections: { id: number; name: string }[]
}

export function TopicSessions({ sessions, subsections }: Props) {
  const [filter, setFilter] = useState<string>("all")

  const filtered = filter === "all" ? sessions : sessions.filter((s) => {
    if (s.type === "recall") {
      return s.data.subsections.some((sub) => sub.subsection_name === filter)
    }
    return s.data.answers.some((a) => a.subsection_name === filter)
  })

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-medium">Session History</h2>
        {subsections.length > 0 && (
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-7 w-48 px-2 py-1.5 text-xs">
              <SelectValue placeholder="All subsections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All subsections</SelectItem>
              {subsections.map((s) => (
                <SelectItem key={s.id} value={s.name} className="text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {filter === "all" ? "No sessions yet." : `No sessions covering "${filter}".`}
        </p>
      ) : (
        <div className="space-y-6">
          {filtered.map((session) =>
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
                          {session.data.subsections
                            .filter((rs) => filter === "all" || rs.subsection_name === filter)
                            .map((rs) => (
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
                <CardContent className="space-y-4">
                  {session.data.overall_score !== null && session.data.feedback && (
                    <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-4 py-3 text-sm leading-relaxed">
                      {session.data.feedback}
                    </p>
                  )}
                  <div className="space-y-3">
                    {session.data.answers
                      .filter((a) => filter === "all" || a.subsection_name === filter)
                      .map((a, i) => (
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
                          {a.feedback && (
                            <p className="text-sm text-muted-foreground pt-1">{a.feedback}</p>
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
    </>
  )
}
