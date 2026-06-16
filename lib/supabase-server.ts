import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente de Supabase con la SESIÓN del usuario (cookies SSR). Las queries corren
// como el usuario autenticado → RLS aplica. Úsalo en Server Components y route
// handlers del dashboard (lectura via `db.ts`). Es por-request: NO lo hagas
// singleton de módulo (las cookies cambian por request).
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // En Server Components las cookies son de solo lectura → esto lanza y se
          // ignora; el refresco de sesión lo hace el middleware. En Server Actions
          // y route handlers sí escribe (login/logout).
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // no-op: Server Component sin permiso de escritura de cookies.
          }
        },
      },
    },
  );
}
