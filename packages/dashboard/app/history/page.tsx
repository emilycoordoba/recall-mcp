import Link from "next/link"
import { getHistory } from "@/lib/db"
import { Badge } from "@/components/ui/badge"

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null
  if (score >= 4.0)
    return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-transparent">{score.toFixed(1)}</Badge>
  if (score >= 3.0)
    return <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-transparent">{score.toFixed(1)}</Badge>
  return <Badge variant="destructive">{score.toFixed(1)}</Badge>
}

export default async function HistoryPage() {
  const entries = await getHistory()

  // Group by calendar day (YYYY-MM-DD)
  const byDay = new Map<string, typeof entries>()
  for (const entry of entries) {
    const day = entry.date.slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(entry)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {entries.length} sesiones en total
          </p>
        </div>
        <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Dashboard
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-20">No hay sesiones registradas.</p>
      ) : (
        <div className="space-y-8">
          {Array.from(byDay.entries()).map(([day, dayEntries]) => (
            <div key={day}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground capitalize">
                {formatDay(day + "T12:00:00")}
              </h2>
              <div className="overflow-hidden rounded-lg ring-1 ring-border divide-y divide-border">
                {dayEntries.map((entry) => (
                  <div key={`${entry.type}-${entry.id}`} className="flex items-center gap-4 px-4 py-3">
                    <span className="w-12 text-right font-mono text-xs text-muted-foreground shrink-0">
                      {formatTime(entry.date)}
                    </span>
                    <span className={`w-20 shrink-0 text-xs font-medium ${entry.type === "recall" ? "text-foreground" : "text-muted-foreground"}`}>
                      {entry.type === "recall" ? "Recall" : "Quick"}
                    </span>
                    <Link
                      href={`/topics/${entry.topic_id}`}
                      className="flex-1 truncate text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {entry.topic_name}
                    </Link>
                    {entry.group_name && (
                      <Badge variant="outline" className="shrink-0">{entry.group_name}</Badge>
                    )}
                    <div className="shrink-0">
                      <ScoreBadge score={entry.score} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
