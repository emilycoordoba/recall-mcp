"use client"

import Link from "next/link"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
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

type SortKey = "name" | "score_asc" | "score_desc" | "date_asc" | "date_desc" | "days_desc" | "days_asc" | "recalls_desc" | "recalls_asc"

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

interface Props {
  topics: TopicRow[]
  groups: string[]
}

export function DashboardFilters({ topics, groups }: Props) {
  const [search, setSearch] = useState("")
  const [group, setGroup] = useState("all")
  const [sort, setSort] = useState<SortKey>("name")

  const filtered = topics
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
        case "recalls_desc": return b.total_recalls - a.total_recalls
        case "recalls_asc":  return a.total_recalls - b.total_recalls
        default:             return a.name.localeCompare(b.name)
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

        <Select value={group} onValueChange={setGroup}>
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

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
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
              <TableHead className="text-right">Días</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No topics found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((topic) => {
                const days = daysSince(topic.last_recalled_at)
                const daysColor = days === null
                  ? "text-muted-foreground"
                  : days >= 14 ? "text-destructive"
                  : days >= 7  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-muted-foreground"

                return (
                  <TableRow key={topic.id}>
                    <TableCell>
                      <Link href={`/topics/${topic.id}`} className="font-medium underline-offset-4 hover:underline">
                        {topic.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {topic.group_name
                        ? <Badge variant="outline">{topic.group_name}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreBadge score={topic.last_score} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(topic.last_recalled_at)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {topic.total_recalls}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      <span className={daysColor}>{days !== null ? `${days}d` : "—"}</span>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
