"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase-server";

// Server Action de login. signInWithPassword setea las cookies de sesión vía el
// cliente SSR (en Server Actions sí se pueden escribir cookies). Redirige al
// destino original (`next`) o al dashboard.
export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const params = new URLSearchParams({ error: "1" });
    if (next && next !== "/") params.set("next", next);
    redirect(`/login?${params.toString()}`);
  }

  redirect(next.startsWith("/") ? next : "/");
}
