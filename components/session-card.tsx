"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconBolt, IconChevronDown, IconChevronUp, IconListDetails, IconRefresh, IconTrash } from "@tabler/icons-react"
import type { ReviewSessionEntry } from "@/lib/db"
import { timeInTz } from "@/lib/dates"
import { useConfirm } from "@/components/confirm-dialog"

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
        <IconBolt className="h-3 w-3" />Rápido
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

export function SessionCard({ session, tz }: { session: ReviewSessionEntry; tz: string }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [deleted, setDeleted] = useState(false)

  const completedSlots = session.slots.filter((s) => s.score !== null).length
  const avgScore = completedSlots > 0
    ? session.slots.filter((s) => s.score !== null).reduce((acc, s) => acc + s.score!, 0) / completedSlots
    : null

  async function handleDelete() {
    const ok = await confirm({
      title: `¿Borrar la sesión #${session.id}?`,
      description:
        "Se elimina solo el registro de la sesión de repaso. Los recalls y repasos rápidos que hiciste se conservan en el historial de cada tema.",
      confirmText: "Borrar sesión",
      destructive: true,
    })
    if (!ok) return
    setDeleted(true) // optimistic
    const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" })
    if (!res.ok) {
      setDeleted(false) // rollback
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "No se pudo borrar la sesión")
    } else {
      toast.success("Sesión borrada")
      router.refresh()
    }
  }

  if (deleted) return null

  return (
    <div className="group overflow-hidden rounded-lg ring-1 ring-border">
      {/* Header row */}
      <div className="flex items-center hover:bg-muted/30 transition-colors">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left"
        >
          <span className="font-mono text-xs text-muted-foreground shrink-0 w-12">
            {timeInTz(session.started_at, tz)}
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

        <Button
          variant="ghost"
          size="icon-xs"
          title="Borrar sesión"
          onClick={handleDelete}
          className="mr-2 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100 hover:text-destructive"
        >
          <IconTrash className="size-3.5" />
        </Button>
      </div>

      {/* Slots */}
      {open && (
        <div className="divide-y divide-border border-t border-border">
          {session.slots.map((slot) => (
            <div key={slot.slot_number} className="flex items-center gap-3 px-4 py-2.5 bg-muted/10">
              <span className="text-xs text-muted-foreground font-mono shrink-0 w-5 text-right">
                {slot.slot_number}
              </span>

              <span className="text-xs text-muted-foreground shrink-0 w-16 hidden sm:block">
                {SLOT_LABEL[slot.slot_number] ?? "Extra"}
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
