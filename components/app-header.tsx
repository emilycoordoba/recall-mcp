import Link from "next/link"
import { Logo } from "@/components/logo"
import { LogoutButton } from "@/components/logout-button"
import { ThemeToggle } from "@/components/theme-toggle"

// Barra de navegación común a todas las páginas: marca (link al inicio) + nav +
// salir. Antes cada página repetía su propio header con patrones de navegación
// distintos (nav completa en `/`, "← Dashboard" en sesiones/historial, "Volver"
// en ajustes); esto los unifica. Responsive: apila en móvil, fila en ≥sm.
const NAV = [
  { href: "/sessions", label: "Sesiones" },
  { href: "/history", label: "Historial" },
  { href: "/prompt", label: "Prompt" },
  { href: "/settings", label: "Ajustes" },
]

export function AppHeader({ streak = 0 }: { streak?: number }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <Link href="/app" aria-label="Ir al inicio" className="w-fit">
        <Logo />
      </Link>
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {streak > 0 && (
          <span className="font-medium text-orange-500">
            🔥 {streak} {streak === 1 ? "día" : "días"}
          </span>
        )}
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            {item.label}
          </Link>
        ))}
        <LogoutButton />
        <ThemeToggle />
      </nav>
    </header>
  )
}
