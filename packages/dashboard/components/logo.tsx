import { cn } from "@/lib/utils"

/**
 * Marca de Recall: un bucle circular que se cierra sobre un punto central
 * (el "punto de memoria"), con la flecha apuntando de vuelta hacia adentro
 * — la idea de *recall*, recuperar lo aprendido.
 *
 * El degradado magenta es fijo (color de marca). Acepta className para
 * dimensionar con utilidades de Tailwind (p. ej. `size-7`).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={cn("shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id="recall-logo-g" x1="16" y1="10" x2="48" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D11FB5" />
          <stop offset="1" stopColor="#8A1C84" />
        </linearGradient>
      </defs>
      <path d="M41 16.41 A18 18 0 1 1 23 16.41" stroke="url(#recall-logo-g)" strokeWidth="6" strokeLinecap="round" />
      <path d="M30.79 11.91 L24.7 22.36 L18.7 11.96 Z" fill="url(#recall-logo-g)" />
      <circle cx="32" cy="32" r="5.5" fill="url(#recall-logo-g)" />
    </svg>
  )
}

/**
 * Lockup horizontal: marca + wordmark. El texto usa currentColor para
 * adaptarse a modo claro/oscuro y hereda la tipografía de heading.
 */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-7" />
      {showWordmark && (
        <span className="font-heading text-lg font-semibold tracking-tight">Recall</span>
      )}
    </span>
  )
}
