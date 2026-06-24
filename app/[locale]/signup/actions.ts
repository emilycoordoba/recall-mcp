"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

// Token MCP: 32 bytes aleatorios en hex (64 chars, igual que los existentes).
function generateMcpToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Signup público. Crea (1) el usuario de Supabase Auth, (2) su fila de perfil en
// `public.users` con un mcp_token propio, (3) el puente auth_id y el
// app_metadata.app_user_id que usa el middleware. Todo con service-role
// (supabaseAdmin) porque bajo RLS el anon no puede insertar en `users`.
//
// email_confirm:true auto-confirma (no hay SMTP configurado). Es deuda conocida:
// no verifica que el email sea del solicitante — aceptable para esta app personal,
// revisar si crece.
export async function signup(formData: FormData) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "auth" });

  // Redirige a /signup con el mensaje de error (locale-aware).
  function fail(message: string): never {
    redirect(`/${locale}/signup?error=${encodeURIComponent(message)}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) fail(t("errFillAll"));
  if (password.length < 8) fail(t("errPassword"));

  // 1) Crear el usuario de Auth.
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (createErr || !created?.user) {
    // El caso típico es email ya registrado.
    fail(createErr?.message?.includes("already") ? t("errEmailTaken") : t("errCreate"));
  }
  const authUser = created.user;

  // 2) Crear la fila de perfil. Si falla, borrar el auth user para no dejar
  // huérfanos (el signup debe ser atómico de cara al usuario).
  const { data: profile, error: insertErr } = await supabaseAdmin
    .from("users")
    .insert({
      name,
      mcp_token: generateMcpToken(),
      dashboard_user: email,
      auth_id: authUser.id,
    })
    .select("id")
    .single();
  if (insertErr || !profile) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    fail(t("errProfile"));
  }

  // 3) Guardar users.id en app_metadata para que el middleware lo resuelva sin
  // consultar la DB (igual que el seed).
  const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    app_metadata: { app_user_id: profile.id },
  });
  if (metaErr) {
    await supabaseAdmin.from("users").delete().eq("id", profile.id);
    await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    fail(t("errFinalize"));
  }

  // Iniciar sesión y entrar al dashboard.
  const supabase = await getServerSupabase();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) redirect(`/${locale}/login`);

  redirect(`/${locale}/app`);
}
