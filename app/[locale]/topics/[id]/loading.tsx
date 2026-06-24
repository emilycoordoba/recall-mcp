import { useTranslations } from "next-intl"
import { BackButton } from "@/components/back-button"
import { Skeleton } from "@/components/ui/skeleton"

// Skeleton del detalle de tema: header (título, grupos, descripción, stats),
// card de subsecciones e historial de sesiones.
export default function Loading() {
  const t = useTranslations("common")
  return (
    <div className="mx-auto max-w-4xl px-6 py-10" aria-busy="true" aria-label={t("loading")}>
      <BackButton />

      {/* Header del tema */}
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
        <Skeleton className="mt-2 h-3 w-44" />
      </div>

      {/* Card de subsecciones */}
      <div className="mb-8 rounded-lg border bg-card">
        <div className="border-b border-border p-4">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full max-w-md" />
          ))}
        </div>
      </div>

      {/* Historial de sesiones */}
      <Skeleton className="mb-4 h-5 w-44" />
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-10" />
            </div>
            <Skeleton className="mt-4 h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
