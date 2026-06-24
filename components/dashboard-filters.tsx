"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { toast } from "sonner"
import { IconTrash, IconArrowMerge, IconX } from "@tabler/icons-react"
import { useConfirm } from "@/components/confirm-dialog"
import { Link } from "@/i18n/navigation"
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
import { GroupChips, GroupCombobox, type GroupRef } from "@/components/group-editor"
import { DifficultyBadge } from "@/components/difficulty-badge"
import { TopicKindBadge } from "@/components/topic-kind-badge"
import type { TopicRow } from "@/lib/db"
import type { TopicKind } from "@/lib/topic-kind"

// Práctica procedimental (mate): solo estos topics usan dificultad. Misma
// condición que el motor SM-2 para elegir la escalera densa (solo quick reviews).
function isProcedural(t: TopicRow) {
  return t.total_quick_reviews > 0 && t.total_recalls === 0
}

type SortKey = "name" | "score_asc" | "score_desc" | "date_asc" | "date_desc" | "days_desc" | "days_asc" | "recalls_desc" | "recalls_asc" | "urgency_desc" | "urgency_asc" | "overdue_desc" | "overdue_asc"

// Mapea el locale de la app a un locale BCP-47 para Intl/toLocaleDateString.
function dateLocale(locale: string) {
  return locale === "en" ? "en-US" : "es-ES"
}

function formatDate(iso: string | null, tz: string, locale: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(dateLocale(locale), { timeZone: tz, day: "2-digit", month: "short", year: "numeric" })
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

// Helpers de API para grupos de un topic. Devuelven el resultado (o null/false)
// para que cada caller decida cómo reconciliar el estado local. El mensaje de
// error ya viene traducido del caller (estos helpers están fuera de React).
async function apiAddGroup(topicId: number, name: string, errMsg: string): Promise<GroupRef | null> {
  const res = await fetch(`/api/topics/${topicId}/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    toast.error(data.error ?? errMsg)
    return null
  }
  const { group } = (await res.json()) as { group: GroupRef }
  return group
}

async function apiRemoveGroup(topicId: number, groupId: number, errMsg: string): Promise<boolean> {
  const res = await fetch(`/api/topics/${topicId}/groups?groupId=${groupId}`, { method: "DELETE" })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    toast.error(data.error ?? errMsg)
    return false
  }
  return true
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
  const t = useTranslations("filters")
  if (daysOverdue === null) return <span className="text-muted-foreground font-mono text-xs">—</span>
  if (daysOverdue > 0) {
    const cls = dimmed ? "text-muted-foreground" : "text-destructive"
    return <span className={`${cls} font-mono text-xs`}>+{daysOverdue}d</span>
  }
  if (daysOverdue === 0) return <span className="text-yellow-600 dark:text-yellow-400 font-mono text-xs">{t("today")}</span>
  return <span className="text-muted-foreground font-mono text-xs">{t("inDays", { days: -daysOverdue })}</span>
}

// El color rojo de "vencido" solo se justifica cuando el agendado se apoya en
// datos suficientes (≥2 prácticas). Antes se medía con total_recalls, pero los
// temas procedimentales (mate) nunca tienen recalls completos → quedaban SIEMPRE
// atenuados (gris) aunque tuvieran muchos quick reviews. Contamos ambas fuentes,
// que es lo que realmente alimenta SM-2 (ver lib/topic-kind.ts smScheduleSource).
function scheduleSignalDimmed(t: TopicRow): boolean {
  return t.total_recalls + t.total_quick_reviews < 2
}

function TrendIndicator({ trend }: { trend: "up" | "down" | "flat" | null }) {
  if (trend === null) return null
  if (trend === "up")   return <span className="text-xs text-green-600 dark:text-green-400">↑</span>
  if (trend === "down") return <span className="text-xs text-destructive">↓</span>
  return <span className="text-xs text-muted-foreground">→</span>
}

function TopicNameCell({ topic, onRename }: { topic: TopicRow; onRename: (id: number, newName: string) => Promise<void> }) {
  const t = useTranslations("filters")
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
        className="w-full rounded-md border border-ring bg-background px-1.5 py-0.5 text-sm font-medium outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
      />
    )
  }

  return (
    <span className="group inline-flex items-center gap-1.5">
      <Link href={`/topics/${topic.id}`} className="font-medium underline-offset-4 hover:underline">
        {topic.name}
      </Link>
      <TopicKindBadge kind={topic.kind} />
      <button
        onClick={startEdit}
        title={t("editName")}
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
  alwaysVisible = false,
}: {
  topic: TopicRow
  targets: TopicRow[]
  onMerge: (sourceId: number, targetId: number) => Promise<void>
  onDelete: (id: number) => Promise<void>
  // En la vista de tabla las acciones aparecen al hacer hover sobre la fila; en
  // móvil (tarjetas) no hay hover, así que se muestran siempre.
  alwaysVisible?: boolean
}) {
  const t = useTranslations("filters")
  const confirm = useConfirm()
  const [merging, setMerging] = useState(false)
  const [busy, setBusy] = useState(false)

  async function pickTarget(targetId: string) {
    const target = targets.find((t) => String(t.id) === targetId)
    if (!target) return
    const ok = await confirm({
      title: t("mergeConfirmTitle", { source: topic.name, target: target.name }),
      description: t("mergeConfirmDesc", { source: topic.name }),
      confirmText: t("mergeConfirm"),
    })
    if (!ok) return
    setBusy(true)
    await onMerge(topic.id, target.id)
    setBusy(false)
    setMerging(false)
  }

  async function remove() {
    const ok = await confirm({
      title: t("deleteConfirmTitle", { name: topic.name }),
      description: t("deleteConfirmDesc"),
      confirmText: t("deleteConfirm"),
      destructive: true,
    })
    if (!ok) return
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
            <SelectValue placeholder={targets.length ? t("mergeWith") : t("noTargets")} />
          </SelectTrigger>
          <SelectContent>
            {targets.map((t) => (
              <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="size-7" disabled={busy} title={t("cancel")} onClick={() => setMerging(false)}>
          <IconX className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-end gap-0.5${alwaysVisible ? "" : " opacity-0 group-hover/row:opacity-100 transition-opacity"}`}>
      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" disabled={busy} title={t("mergeWithOther")} onClick={() => setMerging(true)}>
        <IconArrowMerge className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" disabled={busy} title={t("deleteTopic")} onClick={remove}>
        <IconTrash className="size-3.5" />
      </Button>
    </div>
  )
}

// Vista de un tema en móvil: la misma información que una fila de la tabla, pero
// apilada en una tarjeta legible con el pulgar (la tabla se oculta < md). Reusa
// los mismos sub-componentes y handlers para no duplicar lógica.
function MobileTopicCard({
  topic,
  selected,
  onToggle,
  onRename,
  allGroups,
  onAddGroup,
  onRemoveGroup,
  targets,
  onMerge,
  onDelete,
  tz,
}: {
  topic: TopicRow
  selected: boolean
  onToggle: () => void
  onRename: (id: number, newName: string) => Promise<void>
  allGroups: GroupRef[]
  onAddGroup: (name: string) => void
  onRemoveGroup: (groupId: number) => void
  targets: TopicRow[]
  onMerge: (sourceId: number, targetId: number) => Promise<void>
  onDelete: (id: number) => Promise<void>
  tz: string
}) {
  const t = useTranslations("filters")
  const locale = useLocale()
  return (
    <div
      data-state={selected ? "selected" : undefined}
      className="rounded-lg ring-1 ring-border p-4 space-y-3 data-[state=selected]:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            aria-label={t("selectAria", { name: topic.name })}
            className="mt-1 size-4 shrink-0 accent-primary"
            checked={selected}
            onChange={onToggle}
          />
          <div className="space-y-1.5">
            <TopicNameCell topic={topic} onRename={onRename} />
            <GroupChips
              groups={topic.groups}
              allGroups={allGroups}
              onAdd={onAddGroup}
              onRemove={(g) => onRemoveGroup(g.id)}
            />
          </div>
        </div>
        <RowActions topic={topic} targets={targets} onMerge={onMerge} onDelete={onDelete} alwaysVisible />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          {t("scoreLabel")}
          <RetentionBadge score={topic.last_score} effectiveScore={topic.effective_score} retention={topic.retention} />
          <TrendIndicator trend={topic.score_trend} />
        </span>
        {isProcedural(topic) && (
          <DifficultyBadge
            level={topic.last_difficulty ?? topic.suggested_difficulty}
            title={
              topic.last_difficulty === null
                ? t("diffSuggested", { level: topic.suggested_difficulty })
                : t("diffCurrent", { current: topic.last_difficulty, suggested: topic.suggested_difficulty })
            }
          />
        )}
        <span>{t("lastLabel", { date: formatDate(topic.last_recalled_at, tz, locale) })}</span>
        <span>{t("recallCount", { count: topic.total_recalls })}</span>
        <span className="inline-flex items-center gap-1">
          {t("nextLabel")} <NextReviewCell daysOverdue={topic.days_overdue} dimmed={scheduleSignalDimmed(topic)} />
        </span>
      </div>
    </div>
  )
}

interface Props {
  topics: TopicRow[]
  groups: string[]
  allGroups: GroupRef[]
  tz: string
}

export function DashboardFilters({ topics, groups, allGroups, tz }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const t = useTranslations("filters")
  const locale = useLocale()
  const [localTopics, setLocalTopics] = useState(topics)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
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
  const [kind, setKind] = useState<"all" | TopicKind>(() => {
    if (typeof window === "undefined") return "all"
    const stored = localStorage.getItem("dashboard-kind")
    return stored === "teorico" || stored === "practico" || stored === "teorico_practico" ? stored : "all"
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
      toast.error(data.error ?? t("toastRenameError"))
    } else {
      router.refresh()
    }
  }

  function deselect(id: number) {
    setSelected((s) => {
      if (!s.has(id)) return s
      const next = new Set(s)
      next.delete(id)
      return next
    })
  }

  async function handleDelete(id: number) {
    const prev = localTopics
    setLocalTopics((ts) => ts.filter((t) => t.id !== id))
    deselect(id)
    const res = await fetch(`/api/topics/${id}`, { method: "DELETE" })
    if (!res.ok) {
      setLocalTopics(prev)
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? t("toastDeleteError"))
    } else {
      toast.success(t("toastDeleted"))
      router.refresh()
    }
  }

  async function handleMerge(sourceId: number, targetId: number) {
    const prev = localTopics
    setLocalTopics((ts) => ts.filter((t) => t.id !== sourceId))
    deselect(sourceId)
    const res = await fetch(`/api/topics/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId, targetId }),
    })
    if (!res.ok) {
      setLocalTopics(prev)
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? t("toastMergeError"))
    } else {
      toast.success(t("toastMerged"))
      router.refresh()
    }
  }

  // --- Grupos por fila (optimista) ---
  async function addGroupToTopic(topicId: number, name: string) {
    const group = await apiAddGroup(topicId, name, t("toastAddGroupError"))
    if (!group) return
    setLocalTopics((ts) => ts.map((t) => {
      if (t.id !== topicId || t.groups.some((g) => g.id === group.id)) return t
      return { ...t, groups: [...t.groups, group].sort((a, b) => a.name.localeCompare(b.name)) }
    }))
    router.refresh()
  }

  async function removeGroupFromTopic(topicId: number, groupId: number) {
    const prev = localTopics
    setLocalTopics((ts) => ts.map((t) => t.id === topicId ? { ...t, groups: t.groups.filter((g) => g.id !== groupId) } : t))
    const ok = await apiRemoveGroup(topicId, groupId, t("toastRemoveGroupError"))
    if (!ok) { setLocalTopics(prev); return }
    router.refresh()
  }

  // --- Selección múltiple + acciones masivas ---
  function toggleSelect(id: number) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function bulkAddGroup(name: string) {
    const ids = [...selected]
    if (ids.length === 0) return
    setBulkBusy(true)
    const results = await Promise.all(ids.map((id) => apiAddGroup(id, name, t("toastAddGroupError"))))
    setLocalTopics((ts) => ts.map((t) => {
      const idx = ids.indexOf(t.id)
      const group = idx === -1 ? null : results[idx]
      if (!group || t.groups.some((g) => g.id === group.id)) return t
      return { ...t, groups: [...t.groups, group].sort((a, b) => a.name.localeCompare(b.name)) }
    }))
    setBulkBusy(false)
    router.refresh()
  }

  async function bulkRemoveGroup(groupId: number) {
    const ids = selectedTopics.filter((t) => t.groups.some((g) => g.id === groupId)).map((t) => t.id)
    if (ids.length === 0) return
    setBulkBusy(true)
    const results = await Promise.all(ids.map((id) => apiRemoveGroup(id, groupId, t("toastRemoveGroupError"))))
    const okIds = ids.filter((_, i) => results[i])
    setLocalTopics((ts) => ts.map((t) => okIds.includes(t.id) ? { ...t, groups: t.groups.filter((g) => g.id !== groupId) } : t))
    setBulkBusy(false)
    router.refresh()
  }

  async function bulkDelete() {
    const ids = selectedTopics.map((t) => t.id)
    if (ids.length === 0) return
    const ok = await confirm({
      title: t("bulkDeleteTitle", { count: ids.length }),
      description: t("deleteConfirmDesc"),
      confirmText: t("bulkDelete"),
      destructive: true,
    })
    if (!ok) return
    const prev = localTopics
    setBulkBusy(true)
    setLocalTopics((ts) => ts.filter((t) => !ids.includes(t.id)))
    const results = await Promise.all(ids.map((id) => fetch(`/api/topics/${id}`, { method: "DELETE" })))
    const failedIds = ids.filter((_, i) => !results[i].ok)
    setBulkBusy(false)
    if (failedIds.length > 0) {
      // Restaura solo los que fallaron; los borrados con éxito quedan fuera.
      const failedTopics = prev.filter((t) => failedIds.includes(t.id))
      setLocalTopics((ts) => [...ts, ...failedTopics])
      toast.error(t("bulkDeletePartial", { failed: failedIds.length, total: ids.length }))
    } else {
      toast.success(t("bulkDeleted", { count: ids.length }))
    }
    setSelected((s) => {
      const next = new Set(s)
      ids.forEach((id) => { if (!failedIds.includes(id)) next.delete(id) })
      return next
    })
    router.refresh()
  }

  const filtered = localTopics
    .filter((t) => group === "all" || t.groups.some((g) => g.name === group))
    .filter((t) => kind === "all" || t.kind === kind)
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

  // Selección efectiva: solo los topics visibles (filtrados) que están marcados.
  const selectedTopics = filtered.filter((t) => selected.has(t.id))
  const allFilteredSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id))
  const someFilteredSelected = filtered.some((t) => selected.has(t.id))
  // Grupos presentes en la selección (dedupe por id) → opciones de "Quitar de".
  const groupsInSelection = Array.from(
    new Map(selectedTopics.flatMap((t) => t.groups).map((g) => [g.id, g])).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  function toggleSelectAll() {
    setSelected((s) => {
      const next = new Set(s)
      if (filtered.length > 0 && filtered.every((t) => next.has(t.id))) {
        filtered.forEach((t) => next.delete(t.id))
      } else {
        filtered.forEach((t) => next.add(t.id))
      }
      return next
    })
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 w-48 rounded-md border border-input bg-input/20 px-2 py-1.5 text-xs placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
        />

        <Select value={group} onValueChange={(v) => { setGroup(v); localStorage.setItem("dashboard-group", v) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("allGroups")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allGroups")}</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={kind} onValueChange={(v) => { const k = v as "all" | TopicKind; setKind(k); localStorage.setItem("dashboard-kind", k) }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t("allKinds")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allKinds")}</SelectItem>
            <SelectItem value="teorico">{t("kindTeorico")}</SelectItem>
            <SelectItem value="practico">{t("kindPractico")}</SelectItem>
            <SelectItem value="teorico_practico">{t("kindTeoricoPractico")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => { const k = v as SortKey; setSort(k); localStorage.setItem("dashboard-sort", k) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("sortPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">{t("sortName")}</SelectItem>
            <SelectItem value="score_desc">{t("sortScoreDesc")}</SelectItem>
            <SelectItem value="score_asc">{t("sortScoreAsc")}</SelectItem>
            <SelectItem value="date_desc">{t("sortDateDesc")}</SelectItem>
            <SelectItem value="date_asc">{t("sortDateAsc")}</SelectItem>
            <SelectItem value="days_desc">{t("sortDaysDesc")}</SelectItem>
            <SelectItem value="days_asc">{t("sortDaysAsc")}</SelectItem>
            <SelectItem value="recalls_desc">{t("sortRecallsDesc")}</SelectItem>
            <SelectItem value="recalls_asc">{t("sortRecallsAsc")}</SelectItem>
            <SelectItem value="urgency_desc">{t("sortUrgencyDesc")}</SelectItem>
            <SelectItem value="urgency_asc">{t("sortUrgencyAsc")}</SelectItem>
            <SelectItem value="overdue_desc">{t("sortOverdueDesc")}</SelectItem>
            <SelectItem value="overdue_asc">{t("sortOverdueAsc")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Barra de acciones masivas — aparece al seleccionar filas */}
      {selectedTopics.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{t("selectedCount", { count: selectedTopics.length })}</span>

          <span className="flex items-center gap-1.5 text-muted-foreground">
            {t("bulkGroupInto")}
            <GroupCombobox
              allGroups={allGroups}
              exclude={[]}
              onPick={bulkAddGroup}
              disabled={bulkBusy}
            />
          </span>

          {groupsInSelection.length > 0 && (
            <Select disabled={bulkBusy} onValueChange={(v) => bulkRemoveGroup(Number(v))}>
              <SelectTrigger className="h-7 w-44 px-2 py-1 text-xs">
                <SelectValue placeholder={t("bulkRemoveFrom")} />
              </SelectTrigger>
              <SelectContent>
                {groupsInSelection.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)} className="text-xs">
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
            disabled={bulkBusy}
            onClick={bulkDelete}
          >
            <IconTrash className="size-3.5" />
            {t("bulkDelete")}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={bulkBusy} onClick={() => setSelected(new Set())}>
            {t("clearSelection")}
          </Button>
        </div>
      )}

      {/* Tabla — solo desktop (≥ md) */}
      <div className="mt-6 hidden overflow-hidden rounded-lg ring-1 ring-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-px">
                <input
                  type="checkbox"
                  aria-label={t("selectAll")}
                  className="size-4 align-middle accent-primary"
                  checked={allFilteredSelected}
                  ref={(el) => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected }}
                  onChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>{t("colTopic")}</TableHead>
              <TableHead>{t("colGroup")}</TableHead>
              <TableHead className="text-center">{t("colLastScore")}</TableHead>
              <TableHead>{t("colLastRecall")}</TableHead>
              <TableHead className="text-right">{t("colRecalls")}</TableHead>
              <TableHead className="text-right">{t("colNext")}</TableHead>
              <TableHead className="w-px text-right"><span className="sr-only">{t("colActions")}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  {t("noTopics")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((topic) => (
                  <TableRow key={topic.id} data-state={selected.has(topic.id) ? "selected" : undefined} className="group/row">
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={t("selectAria", { name: topic.name })}
                        className="size-4 align-middle accent-primary"
                        checked={selected.has(topic.id)}
                        onChange={() => toggleSelect(topic.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <TopicNameCell topic={topic} onRename={handleRename} />
                    </TableCell>
                    <TableCell>
                      <GroupChips
                        groups={topic.groups}
                        allGroups={allGroups}
                        onAdd={(name) => addGroupToTopic(topic.id, name)}
                        onRemove={(g) => removeGroupFromTopic(topic.id, g.id)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <RetentionBadge score={topic.last_score} effectiveScore={topic.effective_score} retention={topic.retention} />
                        <TrendIndicator trend={topic.score_trend} />
                      </span>
                      {isProcedural(topic) && (
                        <div className="mt-1 flex justify-center">
                          <DifficultyBadge
                            level={topic.last_difficulty ?? topic.suggested_difficulty}
                            title={
                              topic.last_difficulty === null
                                ? t("diffSuggested", { level: topic.suggested_difficulty })
                                : t("diffCurrent", { current: topic.last_difficulty, suggested: topic.suggested_difficulty })
                            }
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(topic.last_recalled_at, tz, locale)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {topic.total_recalls}
                    </TableCell>
                    <TableCell className="text-right">
                      <NextReviewCell daysOverdue={topic.days_overdue} dimmed={scheduleSignalDimmed(topic)} />
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

      {/* Tarjetas — solo móvil (< md) */}
      <div className="mt-6 space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">{t("noTopics")}</p>
        ) : (
          filtered.map((topic) => (
            <MobileTopicCard
              key={topic.id}
              topic={topic}
              selected={selected.has(topic.id)}
              onToggle={() => toggleSelect(topic.id)}
              onRename={handleRename}
              allGroups={allGroups}
              onAddGroup={(name) => addGroupToTopic(topic.id, name)}
              onRemoveGroup={(groupId) => removeGroupFromTopic(topic.id, groupId)}
              targets={localTopics.filter((t) => t.id !== topic.id)}
              onMerge={handleMerge}
              onDelete={handleDelete}
              tz={tz}
            />
          ))
        )}
      </div>
    </>
  )
}
