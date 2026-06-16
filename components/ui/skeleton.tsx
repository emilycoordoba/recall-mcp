import { cn } from "@/lib/utils"

// Bloque "esqueleto" para estados de carga. Usa el mismo token de radio y el
// color muted del sistema visual; se dimensiona con utilidades de Tailwind.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted/60", className)} {...props} />
}

export { Skeleton }
