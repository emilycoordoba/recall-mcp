"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { IconCheck, IconX, IconChevronDown, IconChevronUp, IconBolt } from "@tabler/icons-react"
import type { HistoryEntry } from "@/lib/db"

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null
  if (score >= 4.0)
    return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-transparent shrink-0">{score.toFixed(1)}</Badge>
  if (score >= 3.0)
    return <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-transparent shrink-0">{score.toFixed(1)}</Badge>
  return <Badge variant="destructive" className="shrink-0">{score.toFixed(1)}</Badge>
}

export function HistoryEntryRow({ entry }: { entry: HistoryEntry }) {
  const [open, setOpen] = useState(false)
  const isRecall = entry.type === "recall"

  const subsectionPreview = isRecall
    ? null
    : entry.answers.map((a) => a.subsection_name).filter(Boolean).join(" · ")

  return (
    <div>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="w-12 text-right font-mono text-xs text-muted-foreground shrink-0">
          {formatTime(entry.date)}
        </span>

        <div className="w-24 shrink-0">
          {isRecall ? (
            <Badge variant="outline" className="text-xs">Recall</Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs w-fit">
              <IconBolt className="h-3 w-3" />
              Quick
            </Badge>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <Link
            href={`/topics/${entry.topic_id}`}
            className="text-sm font-medium underline-offset-4 hover:underline truncate block"
          >
            {entry.topic_name}
          </Link>
          {subsectionPreview && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{subsectionPreview}</p>
          )}
        </div>

        {entry.group_name && (
          <Badge variant="outline" className="shrink-0 hidden sm:flex">{entry.group_name}</Badge>
        )}

        <ScoreBadge score={entry.score} />

        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={open ? "Ocultar detalles" : "Ver detalles"}
        >
          {open ? <IconChevronUp className="h-4 w-4" /> : <IconChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded details */}
      {open && (
        <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-3">
          {isRecall ? (
            <>
              {entry.subsections.length > 0 && (
                <div className="space-y-1">
                  {entry.subsections.map((s) => (
                    <div key={s.name} className="flex items-center gap-2 text-sm">
                      {s.covered
                        ? <IconCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        : <IconX className="h-3.5 w-3.5 text-destructive shrink-0" />}
                      <span className={s.covered ? "" : "text-muted-foreground"}>{s.name}</span>
                      {s.score !== null && (
                        <span className="ml-auto font-mono text-xs text-muted-foreground">{s.score.toFixed(1)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {entry.feedback && (
                <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  {entry.feedback}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              {entry.answers.map((a, i) => (
                <div key={i} className="rounded-md bg-muted/50 px-3 py-2 text-xs space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-foreground leading-snug">{a.question}</span>
                    {a.score !== null && (
                      <span className="font-mono text-muted-foreground shrink-0">{a.score.toFixed(1)}</span>
                    )}
                  </div>
                  {a.subsection_name && (
                    <span className="text-muted-foreground">↳ {a.subsection_name}</span>
                  )}
                  {a.answer && (
                    <p className="text-muted-foreground leading-relaxed pt-0.5">{a.answer}</p>
                  )}
                  {a.feedback && (
                    <p className="text-muted-foreground italic">{a.feedback}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
