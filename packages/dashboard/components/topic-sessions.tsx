"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { IconCheck, IconX, IconBolt, IconTrash } from "@tabler/icons-react"
import { DifficultyBadge } from "@/components/difficulty-badge"
import { useConfirm } from "@/components/confirm-dialog"

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
    difficulty: number | null
    answers: QuickAnswer[]
  }
}

type Session = RecallSession | QuickSession

// Inline-editable feedback for a recall. Click to edit, Esc to cancel, blur/save
// to persist via PATCH /api/recalls/[id]. Shows an "add feedback" affordance when empty.
function RecallFeedback({
  recallId,
  initial,
  onSaved,
}: {
  recallId: number
  initial: string | null
  onSaved: (feedback: string | null) => void
}) {
  const router = useRouter()
  const [value, setValue] = useState(initial ?? "")
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  async function commit() {
    const trimmed = value.trim()
    setEditing(false)
    if (trimmed === (initial ?? "")) { setValue(initial ?? ""); return }
    setBusy(true)
    const res = await fetch(`/api/recalls/${recallId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: trimmed }),
    })
    setBusy(false)
    if (!res.ok) {
      setValue(initial ?? "")
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "No se pudo guardar el feedback")
    } else {
      onSaved(trimmed || null)
      router.refresh()
    }
  }

  if (editing) {
    return (
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Feedback</p>
        <textarea
          value={value}
          disabled={busy}
          autoFocus
          rows={3}
          placeholder="Feedback de este recall…"
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setValue(initial ?? ""); setEditing(false) }
          }}
          className="w-full rounded-md border border-ring bg-background px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
        />
      </div>
    )
  }

  if (!value) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        + Agregar feedback
      </button>
    )
  }

  return (
    <div className="group">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Feedback
        <button
          onClick={() => setEditing(true)}
          title="Editar feedback"
          className="text-xs leading-none opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
        >
          ✎
        </button>
      </p>
      <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-4 py-3 text-sm leading-relaxed">{value}</p>
    </div>
  )
}

interface Props {
  sessions: Session[]
  subsections: { id: number; name: string }[]
}

export function TopicSessions({ sessions, subsections }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [filter, setFilter] = useState<string>("all")
  const [localSessions, setLocalSessions] = useState(sessions)

  async function handleDeleteRecall(id: number) {
    const ok = await confirm({
      title: "¿Borrar este recall?",
      description: "Esta acción no se puede deshacer.",
      confirmText: "Borrar recall",
      destructive: true,
    })
    if (!ok) return
    const prev = localSessions
    setLocalSessions((ss) => ss.filter((s) => !(s.type === "recall" && s.data.id === id))) // optimistic
    const res = await fetch(`/api/recalls/${id}`, { method: "DELETE" })
    if (!res.ok) {
      setLocalSessions(prev) // rollback
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "No se pudo borrar el recall")
    } else {
      router.refresh()
    }
  }

  function applyFeedback(id: number, feedback: string | null) {
    setLocalSessions((ss) =>
      ss.map((s) => (s.type === "recall" && s.data.id === id ? { ...s, data: { ...s.data, feedback } } : s)),
    )
  }

  const filtered = filter === "all" ? localSessions : localSessions.filter((s) => {
    if (s.type === "recall") {
      return s.data.subsections.some((sub) => sub.subsection_name === filter)
    }
    return s.data.answers.some((a) => a.subsection_name === filter)
  })

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-medium">Historial de sesiones</h2>
        {subsections.length > 0 && (
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-7 w-48 px-2 py-1.5 text-xs">
              <SelectValue placeholder="Todas las subsecciones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todas las subsecciones</SelectItem>
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
          {filter === "all" ? "Aún no hay sesiones." : `No hay sesiones que cubran "${filter}".`}
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
                      <Badge variant="outline" className="text-xs">Recall completo</Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ScoreBadge score={session.data.overall_score} />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Borrar recall"
                        onClick={() => handleDeleteRecall(session.data.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <IconTrash className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {session.data.subsections.length > 0 && (
                    <div className="overflow-hidden rounded-md ring-1 ring-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subsección</TableHead>
                            <TableHead className="text-center w-20">Cubierta</TableHead>
                            <TableHead className="text-right w-20">Puntaje</TableHead>
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
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Transcripción</p>
                      <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-4 py-3 text-sm leading-relaxed">
                        {session.data.transcript}
                      </p>
                    </div>
                  )}
                  <RecallFeedback
                    recallId={session.data.id}
                    initial={session.data.feedback}
                    onSaved={(fb) => applyFeedback(session.data.id, fb)}
                  />
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
                        Repaso rápido
                      </Badge>
                      {session.data.difficulty !== null && (
                        <DifficultyBadge
                          level={session.data.difficulty}
                          title={`Ejercicios planteados a dificultad ${session.data.difficulty}/5`}
                        />
                      )}
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
