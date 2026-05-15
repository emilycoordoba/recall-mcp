"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { IconBolt, IconChevronDown, IconChevronUp, IconListDetails, IconRefresh } from "@tabler/icons-react"
import type { ReviewSessionEntry } from "@/lib/db"

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground/50 font-mono">—</span>
  const cls =
    score >= 4.0
      ? "bg-green-500/15 text-green-700 dark:text-green-400 border-transparent"
      : score >= 3.0
        ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-transparent"
        : "bg-destructive/15 text-destructive border-transparent"
  return <Badge className={`${cls} shrink-0 font-mono`}>{score.toFixed(1)}</Badge>
}

function FormatBadge({ format }: { format: ReviewSessionEntry["slots"][number]["format"] }) {
  if (format === "quick")
    return (
      <Badge variant="secondary" className="flex items-center gap-1 text-xs w-fit shrink-0">
        <IconBolt className="h-3 w-3" />Quick
      </Badge>
    )
  if (format === "recall_dirigido")
    return (
      <Badge variant="outline" className="flex items-center gap-1 text-xs w-fit shrink-0">
        <IconListDetails className="h-3 w-3" />Dirigido
      </Badge>
    )
  return (
    <Badge variant="outline" className="flex items-center gap-1 text-xs w-fit shrink-0">
      <IconRefresh className="h-3 w-3" />Completo
    </Badge>
  )
}

const SLOT_LABEL: Record<number, string> = { 1: "Urgente", 2: "Fallo", 3: "Consolid.", 4: "Recall" }

export function SessionCard({ session }: { session: ReviewSessionEntry }) {
  const [open, setOpen] = useState(false)

  const completedSlots = session.slots.filter((s) => s.score !== null).length
  const avgScore = completedSlots > 0
    ? session.slots.filter((s) => s.score !== null).reduce((acc, s) => acc + s.score!, 0) / completedSlots
    : null

  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-border">
      {/* Header row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <span className="font-mono text-xs text-muted-foreground shrink-0 w-12">
          {formatTime(session.started_at)}
        </span>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-medium">
            Sesión #{session.id}
          </span>
          {session.group_name && (
            <Badge variant="outline" className="text-xs hidden sm:flex">{session.group_name}</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {completedSlots}/{session.slots.length} completados
          </span>
        </div>

        {avgScore !== null && <ScoreBadge score={Math.round(avgScore * 100) / 100} />}

        <span className="shrink-0 text-muted-foreground">
          {open ? <IconChevronUp className="h-4 w-4" /> : <IconChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Slots */}
      {open && (
        <div className="divide-y divide-border border-t border-border">
          {session.slots.map((slot) => (
            <div key={slot.slot_number} className="flex items-center gap-3 px-4 py-2.5 bg-muted/10">
              <span className="text-xs text-muted-foreground font-mono shrink-0 w-5 text-right">
                {slot.slot_number}
              </span>

              <span className="text-xs text-muted-foreground shrink-0 w-16 hidden sm:block">
                {SLOT_LABEL[slot.slot_number]}
              </span>

              <FormatBadge format={slot.format} />

              <div className="flex-1 min-w-0">
                <Link
                  href={`/topics/${slot.topic_id}`}
                  className="text-sm font-medium underline-offset-4 hover:underline truncate block"
                >
                  {slot.topic_name}
                </Link>
                {slot.subsection_names.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {slot.subsection_names.join(" · ")}
                  </p>
                )}
              </div>

              <ScoreBadge score={slot.score} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
