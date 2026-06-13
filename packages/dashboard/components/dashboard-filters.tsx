"use client"

import Link from "next/link"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { IconTrash, IconArrowMerge, IconX } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TopicRow } from "@/lib/db"

type SortKey = "name" | "score_asc" | "score_desc" | "date_asc" | "date_desc" | "days_desc" | "days_asc" | "recalls_desc" | "recalls_asc" | "urgency_desc" | "urgency_asc" | "overdue_desc" | "overdue_asc"

function formatDate(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">—</span>
  if (score >= 4.0)
    return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-transparent">{score.toFixed(1)}</Badge>
  if (score >= 3.0)
    return <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-transparent">{score.toFixed(1)}</Badge>
  return <Badge variant="destructive">{score.toFixed(1)}</Badge>
}

function RetentionBadge({ score, effectiveScore, retention }: { score: number | null; effectiveScore: number | null; retention: number | null }) {
  if (score === null) return <span className="text-muted-foreground">—</span>
  const decayed = retention !== null && retention < 0.9
  const display = decayed ? effectiveScore : score
  return (
    <span className="inline-flex flex-col items-center gap-0">
      <ScoreBadge score={display} />
      {decayed && retention !== null && (
        <span className="text-[10px] text-muted-foreground">{Math.round(retention * 100)}%</span>
      )}
    </span>
  )
}

function NextReviewCell({ daysOverdue, dimmed }: { daysOverdue: number | null; dimmed?: boolean }) {
  if (daysOverdue === null) return <span className="text-muted-foreground font-mono text-xs">—</span>
  if (daysOverdue > 0) {
    const cls = dimmed ? "text-muted-foreground" : "text-destructive"
    return <span className={`${cls} font-mono text-xs`}>+{daysOverdue}d</span>
  }
  if (daysOverdue === 0) return <span className="text-yellow-600 dark:text-yellow-400 font-mono text-xs">hoy</span>
  return <span className="text-muted-foreground font-mono text-xs">en {-daysOverdue}d</span>
}

function TrendIndicator({ trend }: { trend: "up" | "down" | "flat" | null }) {
  if (trend === null) return null
  if (trend === "up")   return <span className="text-xs text-green-600 dark:text-green-400">↑</span>
  if (trend === "down") return <span className="text-xs text-destructive">↓</span>
  return <span className="text-xs text-muted-foreground">→</span>
}

function TopicNameCell({ topic, onRename }: { topic: TopicRow; onRename: (id: number, newName: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(topic.name)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit(e: React.MouseEvent) {
    e.preventDefault()
    setValue(topic.name)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function commit() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === topic.name) { setEditing(false); return }
    setSaving(true)
    await onRename(topic.id, trimmed)
    setSaving(false)
    setEditing(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit()
    if (e.key === "Escape") { setValue(topic.name); setEditing(false) }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className="w-full rounded border border-ring bg-background px-1.5 py-0.5 text-sm font-medium outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
      />
    )
  }

  return (
    <span className="group inline-flex items-center gap-1.5">
      <Link href={`/topics/${topic.id}`} className="font-medium underline-offset-4 hover:underline">
        {topic.name}
      </Link>
      <button
        onClick={startEdit}
        title="Editar nombre"
        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground transition-opacity text-xs leading-none"
      >
        ✎
      </button>
    </span>
  )
}

function RowActions({
  topic,
  targets,
  onMerge,
  onDelete,
}: {
  topic: TopicRow
  targets: TopicRow[]
  onMerge: (sourceId: number, targetId: number) => Promise<void>
  onDelete: (id: number) => Promise<void>
}) {
  const [merging, setMerging] = useState(false)
  const [busy, setBusy] = useState(false)

  async function pickTarget(targetId: string) {
    const target = targets.find((t) => String(t.id) === targetId)
    if (!target) return
    if (!confirm(`¿Fusionar "${topic.name}" dentro de "${target.name}"? Sus recalls y subsecciones se moverán y "${topic.name}" se eliminará.`)) return
    setBusy(true)
    await onMerge(topic.id, target.id)
    setBusy(false)
    setMerging(false)
  }

  async function remove() {
    if (!confirm(`¿Borrar "${topic.name}" y todo su historial? Esta acción no se puede deshacer.`)) return
    setBusy(true)
    await onDelete(topic.id)
    // Component unmounts on success; resetting busy only matters if it failed.
    setBusy(false)
  }

  if (merging) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Select disabled={busy || targets.length === 0} onValueChange={pickTarget}>
          <SelectTrigger className="h-7 w-44 px-2 py-1 text-xs">
            <SelectValue placeholder={targets.length ? "Fusionar con…" : "Sin destinos"} />
          </SelectTrigger>
          <SelectContent>
            {targets.map((t) => (
              <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="size-7" disabled={busy} title="Cancelar" onClick={() => setMerging(false)}>
          <IconX className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" disabled={busy} title="Fusionar con otro topic" onClick={() => setMerging(true)}>
        <IconArrowMerge className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" disabled={busy} title="Borrar topic" onClick={remove}>
        <IconTrash className="size-3.5" />
      </Button>
    </div>
  )
}

interface Props {
  topics: TopicRow[]
  groups: string[]
}

export function DashboardFilters({ topics, groups }: Props) {
  const router = useRouter()
  const [localTopics, setLocalTopics] = useState(topics)
  const [search, setSearch] = useState("")
  const [group, setGroup] = useState(() => {
    if (typeof window === "undefined") return "all"
    const stored = localStorage.getItem("dashboard-group")
    return stored && (stored === "all" || groups.includes(stored)) ? stored : "all"
  })
  const [sort, setSort] = useState<SortKey>(() => {
    if (typeof window === "undefined") return "name"
    return (localStorage.getItem("dashboard-sort") as SortKey) ?? "name"
  })

  async function handleRename(id: number, newName: string) {
    const prev = localTopics
    setLocalTopics((ts) => ts.map((t) => t.id === id ? { ...t, name: newName } : t))
    const res = await fetch(`/api/topics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    })
    if (!res.ok) {
      setLocalTopics(prev)
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? "Error al renombrar")
    } else {
      router.refresh()
    }
  }

  async function handleDelete(id: number) {
    const prev = localTopics
    setLocalTopics((ts) => ts.filter((t) => t.id !== id))
    const res = await fetch(`/api/topics/${id}`, { method: "DELETE" })
    if (!res.ok) {
      setLocalTopics(prev)
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? "Error al borrar")
    } else {
      router.refresh()
    }
  }

  async function handleMerge(sourceId: number, targetId: number) {
    const prev = localTopics
    setLocalTopics((ts) => ts.filter((t) => t.id !== sourceId))
    const res = await fetch(`/api/topics/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId, targetId }),
    })
    if (!res.ok) {
      setLocalTopics(prev)
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? "Error al fusionar")
    } else {
      router.refresh()
    }
  }

  const filtered = localTopics
    .filter((t) => group === "all" || t.group_name === group)
    .filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sort) {
        case "score_asc":    return (a.last_score ?? -1) - (b.last_score ?? -1)
        case "score_desc":   return (b.last_score ?? -1) - (a.last_score ?? -1)
        case "date_asc":     return (a.last_recalled_at ?? "").localeCompare(b.last_recalled_at ?? "")
        case "date_desc":    return (b.last_recalled_at ?? "").localeCompare(a.last_recalled_at ?? "")
        case "days_desc":    return (daysSince(b.last_recalled_at) ?? -1) - (daysSince(a.last_recalled_at) ?? -1)
        case "days_asc":     return (daysSince(a.last_recalled_at) ?? -1) - (daysSince(b.last_recalled_at) ?? -1)
        case "recalls_desc":  return b.total_recalls - a.total_recalls
        case "recalls_asc":   return a.total_recalls - b.total_recalls
        case "urgency_desc":  return b.urgency - a.urgency
        case "urgency_asc":   return a.urgency - b.urgency
        case "overdue_desc":  return (b.days_overdue ?? -999) - (a.days_overdue ?? -999)
        case "overdue_asc":   return (a.days_overdue ?? 999) - (b.days_overdue ?? 999)
        default:              return a.name.localeCompare(b.name)
      }
    })

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Buscar topic…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 w-48 rounded-md border border-input bg-input/20 px-2 py-1.5 text-xs placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
        />

        <Select value={group} onValueChange={(v) => { setGroup(v); localStorage.setItem("dashboard-group", v) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => { const k = v as SortKey; setSort(k); localStorage.setItem("dashboard-sort", k) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Sort by name" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="score_desc">Sort: Score ↓</SelectItem>
            <SelectItem value="score_asc">Sort: Score ↑</SelectItem>
            <SelectItem value="date_desc">Sort: Date ↓</SelectItem>
            <SelectItem value="date_asc">Sort: Date ↑</SelectItem>
            <SelectItem value="days_desc">Sort: Días ↓</SelectItem>
            <SelectItem value="days_asc">Sort: Días ↑</SelectItem>
            <SelectItem value="recalls_desc">Sort: Recalls ↓</SelectItem>
            <SelectItem value="recalls_asc">Sort: Recalls ↑</SelectItem>
            <SelectItem value="urgency_desc">Sort: Urgencia ↓</SelectItem>
            <SelectItem value="urgency_asc">Sort: Urgencia ↑</SelectItem>
            <SelectItem value="overdue_desc">Sort: Próxima ↓</SelectItem>
            <SelectItem value="overdue_asc">Sort: Próxima ↑</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg ring-1 ring-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Topic</TableHead>
              <TableHead>Group</TableHead>
              <TableHead className="text-center">Last Score</TableHead>
              <TableHead>Last Recall</TableHead>
              <TableHead className="text-right">Recalls</TableHead>
              <TableHead className="text-right">Próxima</TableHead>
              <TableHead className="w-px text-right"><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No topics found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((topic) => (
                  <TableRow key={topic.id} className="group/row">
                    <TableCell>
                      <TopicNameCell topic={topic} onRename={handleRename} />
                    </TableCell>
                    <TableCell>
                      {topic.group_name
                        ? <Badge variant="outline">{topic.group_name}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <RetentionBadge score={topic.last_score} effectiveScore={topic.effective_score} retention={topic.retention} />
                        <TrendIndicator trend={topic.score_trend} />
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(topic.last_recalled_at)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {topic.total_recalls}
                    </TableCell>
                    <TableCell className="text-right">
                      <NextReviewCell daysOverdue={topic.days_overdue} dimmed={topic.total_recalls < 2} />
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        topic={topic}
                        targets={localTopics.filter((t) => t.id !== topic.id)}
                        onMerge={handleMerge}
                        onDelete={handleDelete}
                      />
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
