import Link from "next/link"
import { getTopics } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DashboardFilters } from "@/components/dashboard-filters"

type SortKey = "name" | "score_asc" | "score_desc" | "date_asc" | "date_desc"

function formatDate(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">—</span>
  const variant =
    score >= 4.0 ? "default" : score >= 3.0 ? "secondary" : "destructive"
  return <Badge variant={variant}>{score.toFixed(1)}</Badge>
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; sort?: string }>
}) {
  const { group, sort } = await searchParams
  const allTopics = await getTopics()

  const groups = Array.from(
    new Set(allTopics.map((t) => t.group_name).filter(Boolean))
  ) as string[]

  const filtered =
    group && group !== "all"
      ? allTopics.filter((t) => t.group_name === group)
      : allTopics

  const sortKey = (sort ?? "name") as SortKey
  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case "score_asc":
        return (a.last_score ?? -1) - (b.last_score ?? -1)
      case "score_desc":
        return (b.last_score ?? -1) - (a.last_score ?? -1)
      case "date_asc":
        return (a.last_recalled_at ?? "").localeCompare(
          b.last_recalled_at ?? ""
        )
      case "date_desc":
        return (b.last_recalled_at ?? "").localeCompare(
          a.last_recalled_at ?? ""
        )
      default:
        return a.name.localeCompare(b.name)
    }
  })

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Recall Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {allTopics.length} topics · {groups.length} groups
        </p>
      </div>

      <DashboardFilters groups={groups} currentGroup={group} currentSort={sort} />

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
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground"
                >
                  No topics found
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((topic) => (
                <TableRow key={topic.id}>
                  <TableCell>
                    <Link
                      href={`/topics/${topic.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {topic.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {topic.group_name ? (
                      <Badge variant="outline">{topic.group_name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
                    {(() => {
                      const d = daysSince(topic.last_recalled_at)
                      if (d === null) return <span className="text-muted-foreground">—</span>
                      const color = d >= 14 ? "text-destructive" : d >= 7 ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"
                      return <span className={color}>{d}d</span>
                    })()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
