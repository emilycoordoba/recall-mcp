import { Logo } from "@/components/logo"

// Fallback de Suspense para toda la app (Next lo usa al navegar entre rutas y en
// la carga inicial del server component). Mantiene la marca visible y unos
// bloques "esqueleto" para que la espera no se vea como una pantalla en blanco.
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Logo />
      <div className="mt-8 space-y-3" aria-busy="true" aria-label="Cargando">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/60" />
        ))}
      </div>
    </div>
  )
}
