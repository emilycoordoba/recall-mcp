import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Wrappers locale-aware de las APIs de navegación de Next. Usar estos `Link`,
// `redirect`, `useRouter`, etc. (en vez de los de `next/link` / `next/navigation`)
// para que el prefijo de locale se conserve automáticamente al navegar.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
