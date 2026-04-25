import Link from "next/link"
import { getTopics } from "@/lib/db"
import { DashboardFilters } from "@/components/dashboard-filters"

export default async function DashboardPage() {
  const topics = await getTopics()
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
        <Link href="/history" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Historial →
        </Link>
      </div>
      <DashboardFilters topics={topics} groups={groups} />
    </div>
  )
}
