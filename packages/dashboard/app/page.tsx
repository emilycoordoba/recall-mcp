import Link from "next/link"
import { getTopics, getStudyStreak } from "@/lib/db"
import { DashboardFilters } from "@/components/dashboard-filters"

export const revalidate = 30

export default async function DashboardPage() {
  const [topics, streak] = await Promise.all([getTopics(), getStudyStreak()])
  const groups = Array.from(
    new Set(topics.map((t) => t.group_name).filter(Boolean))
  ) as string[]

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
          <Link href="/history" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Historial →
          </Link>
        </div>
      </div>
      <DashboardFilters topics={topics} groups={groups} />
    </div>
  )
}
