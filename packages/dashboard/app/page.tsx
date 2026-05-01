import Link from "next/link"
import { getTopics, getStudyStreak, type TopicRow } from "@/lib/db"
import { DashboardFilters } from "@/components/dashboard-filters"

export const revalidate = 30

function groupStats(topics: TopicRow[]) {
  const map = new Map<string, TopicRow[]>()
  for (const t of topics) {
    if (!t.group_name) continue
    if (!map.has(t.group_name)) map.set(t.group_name, [])
    map.get(t.group_name)!.push(t)
  }
  return [...map.entries()]
    .map(([name, ts]) => {
      const scored = ts.filter((t) => t.last_score !== null)
      const avg = scored.length ? scored.reduce((s, t) => s + t.last_score!, 0) / scored.length : null
      return {
        name,
        count: ts.length,
        avg_score: avg !== null ? Math.round(avg * 100) / 100 : null,
        below3: ts.filter((t) => t.last_score !== null && t.last_score < 3).length,
      }
    })
    .sort((a, b) => b.count - a.count)
}

export default async function DashboardPage() {
  const [topics, streak] = await Promise.all([getTopics(), getStudyStreak()])
  const groups = Array.from(new Set(topics.map((t) => t.group_name).filter(Boolean))) as string[]
  const stats = groupStats(topics)

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recall Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {topics.length} topics · {groups.length} groups
          </p>
        </div>
        <div className="flex items-center gap-4">
          {streak > 0 && (
            <span className="text-sm font-medium text-orange-500">
              🔥 {streak} {streak === 1 ? "día" : "días"}
            </span>
          )}
          <Link href="/sessions" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Sesiones →
          </Link>
          <Link href="/history" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Historial →
          </Link>
        </div>
      </div>

      {stats.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {stats.map((g) => (
            <div key={g.name} className="rounded-lg border bg-card p-3">
              <p className="truncate text-xs font-medium text-muted-foreground">{g.name}</p>
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
      )}

      <DashboardFilters topics={topics} groups={groups} />
    </div>
  )
}
