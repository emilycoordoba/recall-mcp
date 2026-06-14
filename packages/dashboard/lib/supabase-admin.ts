import { createClient } from "@supabase/supabase-js";

// Cliente con service_role: SALTA RLS. Úsalo SOLO en el servidor y solo donde el
// acceso ya está controlado por otra vía:
//   - MCP (`db-mcp.ts`, `getUserByToken`): el Bearer token ya scopea al usuario;
//     el aislamiento se mantiene a nivel app (`.eq("user_id", …)`).
//   - Seed/admin y signup: crean usuarios en auth.users + fila de perfil.
// NUNCA lo importes desde código que corra en el cliente ni desde el path del
// dashboard con sesión (ese usa `supabase-server.ts`, que respeta RLS).
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
