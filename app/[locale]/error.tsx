"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
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
  const t = useTranslations("error")
  useEffect(() => {
    // El digest ayuda a correlacionar con los logs del servidor en producción.
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-6 text-lg font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {t("body")}
      </p>
      <Button onClick={reset} className="mt-6">
        {t("retry")}
      </Button>
    </div>
  )
}
