"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { IconMoon, IconSun } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

// Island cliente: alterna entre claro/oscuro. El resto del header es Server
// Component, así que solo este botón hidrata. El atajo de teclado `d` vive en
// theme-provider.tsx; esto le da un control visible y descubrible.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Hasta montar, `resolvedTheme` es indefinido (vive en el cliente). Sin este
  // guard el HTML del servidor no coincide con el del cliente → hydration warning.
  React.useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro (d)" : "Modo oscuro (d)"}
      className="text-muted-foreground"
    >
      {mounted && isDark ? <IconSun /> : <IconMoon />}
    </Button>
  )
}
