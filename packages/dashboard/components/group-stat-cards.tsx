"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { IconX } from "@tabler/icons-react"

export interface GroupStat {
  id: number
  name: string
  count: number
  avg_score: number | null
  below3: number
}

// Tarjetas de resumen por grupo. Cada una tiene una × para borrar el grupo
// entero (no sus topics) vía DELETE /api/groups/[id]. Estado optimista: la
// tarjeta desaparece al instante y se restaura si la API falla.
export function GroupStatCards({ stats }: { stats: GroupStat[] }) {
  const router = useRouter()
  const [localStats, setLocalStats] = useState(stats)
  const [busyId, setBusyId] = useState<number | null>(null)

  async function deleteGroup(g: GroupStat) {
    if (!confirm(`¿Borrar el grupo "${g.name}"? Sus ${g.count} topic${g.count === 1 ? "" : "s"} no se borran, solo dejan de pertenecer a este grupo.`)) return
    const prev = localStats
    setLocalStats((s) => s.filter((x) => x.id !== g.id))
    setBusyId(g.id)
    const res = await fetch(`/api/groups/${g.id}`, { method: "DELETE" })
    setBusyId(null)
    if (!res.ok) {
      setLocalStats(prev)
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? "No se pudo borrar el grupo")
      return
    }
    router.refresh()
  }

  if (localStats.length === 0) return null

  return (
    <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {localStats.map((g) => (
        <div key={g.id} className="group/card relative rounded-lg border bg-card p-3">
          <button
            type="button"
            onClick={() => deleteGroup(g)}
            disabled={busyId === g.id}
            title={`Borrar grupo "${g.name}"`}
            className="absolute right-1.5 top-1.5 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/card:opacity-100 disabled:opacity-50"
          >
            <IconX className="size-3.5" />
          </button>
          <p className="truncate pr-5 text-xs font-medium text-muted-foreground">{g.name}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {g.avg_score?.toFixed(1) ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">{g.count} topic{g.count !== 1 ? "s" : ""}</p>
          {g.below3 > 0 && (
            <p className="text-xs text-destructive">{g.below3} bajo 3.0</p>
          )}
        </div>
      ))}
    </div>
  )
}
