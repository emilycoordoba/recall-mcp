import Link from "next/link"
import { getTopics, getStudyStreak, getGroups, type TopicRow } from "@/lib/db"
import { currentUserId } from "@/lib/auth"
import { DashboardFilters } from "@/components/dashboard-filters"
import { GroupStatCards, type GroupStat } from "@/components/group-stat-cards"
import { Logo } from "@/components/logo"
import { LogoutButton } from "@/components/logout-button"

function groupStats(topics: TopicRow[]): GroupStat[] {
  // Agrupa por id (no por nombre) para poder borrar el grupo desde la tarjeta.
  const map = new Map<number, { name: string; topics: TopicRow[] }>()
  for (const t of topics) {
    // Un topic puede pertenecer a varios grupos: cuenta en cada uno.
    for (const g of t.groups) {
      if (!map.has(g.id)) map.set(g.id, { name: g.name, topics: [] })
      map.get(g.id)!.topics.push(t)
    }
  }
  return [...map.entries()]
    .map(([id, { name, topics: ts }]) => {
      const scored = ts.filter((t) => t.last_score !== null)
      const avg = scored.length ? scored.reduce((s, t) => s + t.last_score!, 0) / scored.length : null
      return {
        id,
        name,
        count: ts.length,
        avg_score: avg !== null ? Math.round(avg * 100) / 100 : null,
        below3: ts.filter((t) => t.last_score !== null && t.last_score < 3).length,
      }
    })
    .sort((a, b) => b.count - a.count)
}

export default async function DashboardPage() {
  const userId = await currentUserId()
  const [topics, streak, allGroups] = await Promise.all([
    getTopics(userId),
    getStudyStreak(userId),
    getGroups(userId),
  ])
  const groups = Array.from(new Set(topics.flatMap((t) => t.groups.map((g) => g.name)))).sort((a, b) => a.localeCompare(b))
  const stats = groupStats(topics)

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <Logo />
          <p className="mt-1.5 text-sm text-muted-foreground">
            {topics.length} {topics.length === 1 ? "tema" : "temas"} · {groups.length} {groups.length === 1 ? "grupo" : "grupos"}
          </p>
        </div>
        <nav className="flex items-center gap-4">
          {streak > 0 && (
            <span className="text-sm font-medium text-orange-500">
              🔥 {streak} {streak === 1 ? "día" : "días"}
            </span>
          )}
          <Link href="/sessions" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Sesiones
          </Link>
          <Link href="/history" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Historial
          </Link>
          <Link href="/settings" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Ajustes
          </Link>
          <LogoutButton />
        </nav>
      </div>

      <GroupStatCards stats={stats} />

      <DashboardFilters topics={topics} groups={groups} allGroups={allGroups} />
    </div>
  )
}
