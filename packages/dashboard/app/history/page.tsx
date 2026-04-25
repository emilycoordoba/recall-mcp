import Link from "next/link"
import { getHistory } from "@/lib/db"
import { HistoryEntryRow } from "@/components/history-entry"

export const revalidate = 30

function formatDay(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function HistoryPage() {
  const entries = await getHistory()

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
                {formatDay(day)}
              </h2>
              <div className="overflow-hidden rounded-lg ring-1 ring-border divide-y divide-border">
                {dayEntries.map((entry) => (
                  <HistoryEntryRow key={`${entry.type}-${entry.id}`} entry={entry} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
