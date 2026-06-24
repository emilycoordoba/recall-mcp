import { useTranslations } from "next-intl"
import { AppHeader } from "@/components/app-header"
import { Skeleton } from "@/components/ui/skeleton"

// Skeleton del home (lista de temas). El AppHeader es real (no necesita datos),
// así que la navegación queda presente mientras carga el contenido. El cuerpo
// imita la estructura: conteo, tarjetas de grupo, barra de filtros y la lista.
export default function Loading() {
  const t = useTranslations("common")
  return (
    <div className="mx-auto max-w-5xl px-6 py-10" aria-busy="true" aria-label={t("loading")}>
      <AppHeader />
      <Skeleton className="-mt-4 mb-8 h-4 w-40" />

      {/* Tarjetas de resumen por grupo */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-6 w-10" />
            <Skeleton className="mt-2 h-3 w-12" />
          </div>
        ))}
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-48" />
      </div>

      {/* Lista de temas */}
      <div className="mt-6 space-y-px overflow-hidden rounded-lg ring-1 ring-border">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 bg-card px-4 py-3.5">
            <Skeleton className="size-4 shrink-0" />
            <Skeleton className="h-4 w-40 sm:w-56" />
            <Skeleton className="ml-auto hidden h-5 w-16 sm:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="h-5 w-10 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
