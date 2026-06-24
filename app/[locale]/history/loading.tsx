import { AppHeader } from "@/components/app-header"
import { BackButton } from "@/components/back-button"
import { Skeleton } from "@/components/ui/skeleton"

// Skeleton de /history: título + grupos por día, cada uno un contenedor con
// filas divididas tipo HistoryEntryRow.
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10" aria-busy="true" aria-label="Cargando">
      <AppHeader />
      <BackButton />
      <div className="mb-8">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-32" />
      </div>

      <div className="space-y-8">
        {Array.from({ length: 2 }).map((_, g) => (
          <div key={g}>
            <Skeleton className="mb-3 h-3 w-48" />
            <div className="divide-y divide-border overflow-hidden rounded-lg ring-1 ring-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-3 w-10 shrink-0" />
                  <Skeleton className="h-5 w-16 shrink-0" />
                  <Skeleton className="h-4 w-40 sm:w-52" />
                  <Skeleton className="ml-auto h-5 w-10 shrink-0" />
                  <Skeleton className="size-4 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
