"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"

// Error boundary de ruta (App Router). Atrapa errores de render no controlados y
// ofrece reintentar sin recargar toda la app. Debe ser Client Component.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // El digest ayuda a correlacionar con los logs del servidor en producción.
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-6 text-lg font-semibold tracking-tight">Algo salió mal</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        No pudimos cargar esta página. Probá de nuevo; si sigue fallando, recargá el navegador.
      </p>
      <Button onClick={reset} className="mt-6">
        Reintentar
      </Button>
    </div>
  )
}
