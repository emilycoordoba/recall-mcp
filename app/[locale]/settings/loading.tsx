import { AppHeader } from "@/components/app-header"
import { BackButton } from "@/components/back-button"
import { Skeleton } from "@/components/ui/skeleton"

// Skeleton de /settings: título + descripción + la card de ajustes con su toggle.
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10" aria-busy="true" aria-label="Cargando">
      <AppHeader />
      <BackButton />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="mt-3 h-4 w-full max-w-md" />
      <Skeleton className="mt-1.5 mb-6 h-4 w-3/4 max-w-sm" />

      <Skeleton className="mb-2 h-3 w-40" />
      <div className="rounded-lg border bg-card">
        <div className="flex items-start justify-between gap-6 p-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-full max-w-sm" />
            <Skeleton className="h-3 w-2/3 max-w-xs" />
          </div>
          <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
        </div>
      </div>
    </div>
  )
}
