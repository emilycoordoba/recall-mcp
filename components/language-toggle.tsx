"use client"

import { useTransition } from "react"
import { useLocale } from "next-intl"
import { usePathname, useRouter } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { cn } from "@/lib/utils"

// Selector de idioma: cambia SOLO el prefijo de locale conservando la ruta y los
// query params actuales. Usa las APIs de navegación de next-intl (que ya saben del
// prefijo), así que no hay manipulación manual de strings de URL.
//
// Leemos los query params de window.location en el click (no con useSearchParams)
// para no desoptar del render estático: el landing es SSG y useSearchParams lo
// forzaría a dinámico / a un Suspense boundary.
export function LanguageToggle() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function switchTo(next: string) {
    if (next === locale) return
    const search = typeof window !== "undefined" ? window.location.search : ""
    const query = Object.fromEntries(new URLSearchParams(search))
    startTransition(() => {
      // El href sin prefijo (pathname) + el locale destino reconstruyen la URL.
      router.replace({ pathname, query }, { locale: next })
    })
  }

  return (
    <div className="inline-flex items-center gap-0.5 text-xs" role="group" aria-label="Language">
      {routing.locales.map((l, i) => (
        <span key={l} className="inline-flex items-center">
          {i > 0 && <span className="px-1 text-muted-foreground/40">·</span>}
          <button
            type="button"
            disabled={isPending}
            aria-current={l === locale ? "true" : undefined}
            onClick={() => switchTo(l)}
            className={cn(
              "rounded-sm px-1 uppercase underline-offset-4 transition-colors disabled:opacity-50",
              l === locale
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground hover:underline",
            )}
          >
            {l}
          </button>
        </span>
      ))}
    </div>
  )
}
