"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase-server";

// Server Action de login. signInWithPassword setea las cookies de sesión vía el
// cliente SSR (en Server Actions sí se pueden escribir cookies). Redirige al
// destino original (`next`) o al dashboard.
// Solo permite rutas internas como destino. Rechaza absolutas (`http://…`),
// protocol-relative (`//host`) y `/\host` (que los navegadores tratan como host
// externo) para evitar open redirects.
function safeNext(next: string): string {
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/app";
  }
  return next;
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/app") || "/app");

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const params = new URLSearchParams({ error: "1" });
    if (next !== "/app") params.set("next", next);
    redirect(`/login?${params.toString()}`);
  }

  redirect(next);
}
