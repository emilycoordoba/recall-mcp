// Track D (D1) — seed de usuarios de Supabase Auth desde la tabla `users`.
//
// Crea (idempotente) un usuario en auth.users por cada fila de `public.users`,
// usando su email y su `dashboard_pass` actual como contraseña inicial, y linkea
// `users.auth_id`. Así Emily y Lesty conservan su contraseña al pasar a Auth.
//
// Requisitos:
//   - Migración 2026-06-14_auth-id.sql ya aplicada (columna auth_id existe).
//   - Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//   - Mapa de emails abajo (Auth identifica por email, no por username).
//
// Uso (desde packages/dashboard, con las env cargadas):
//   node ../../scripts/seed-auth-users.mjs
//
// Es seguro re-correrlo: si el email ya existe en auth.users, reusa ese usuario
// y solo asegura el link auth_id.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}

// ── Mapa dashboard_user → email. Completar antes de correr. ──
const EMAILS = {
  emily: "emilycoordoba@gmail.com",
  lesty: "lesty.cordoba@gmail.com",
};

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Busca un usuario de auth.users por email paginando (la admin API no expone
// getUserByEmail directo).
async function findAuthUserByEmail(email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  const { data: users, error } = await admin
    .from("users")
    .select("id, name, dashboard_user, dashboard_pass, auth_id")
    .order("id");
  if (error) throw error;

  for (const u of users) {
    const email = EMAILS[u.dashboard_user];
    if (!email) {
      console.warn(`· ${u.dashboard_user} (id ${u.id}): sin email en EMAILS, salto.`);
      continue;
    }

    let authUser = await findAuthUserByEmail(email);
    if (!authUser) {
      const { data, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: u.dashboard_pass,
        email_confirm: true, // usuarias existentes: confiamos su email
        user_metadata: { name: u.name },
      });
      if (createErr) {
        console.error(`✗ ${email}: no se pudo crear →`, createErr.message);
        continue;
      }
      authUser = data.user;
      console.log(`+ ${email}: auth user creado (${authUser.id})`);
    } else {
      console.log(`= ${email}: auth user ya existía (${authUser.id})`);
    }

    if (u.auth_id !== authUser.id) {
      const { error: linkErr } = await admin
        .from("users")
        .update({ auth_id: authUser.id })
        .eq("id", u.id);
      if (linkErr) {
        console.error(`✗ ${email}: no se pudo linkear auth_id →`, linkErr.message);
        continue;
      }
      console.log(`  ↳ users.id ${u.id}.auth_id = ${authUser.id}`);
    }

    // Guarda el users.id (int) en app_metadata del JWT para que el middleware lo
    // lea sin consultar la DB. app_metadata no es editable por el usuario.
    if (authUser.app_metadata?.app_user_id !== u.id) {
      const { error: metaErr } = await admin.auth.admin.updateUserById(authUser.id, {
        app_metadata: { app_user_id: u.id },
      });
      if (metaErr) console.error(`✗ ${email}: no se pudo set app_metadata →`, metaErr.message);
      else console.log(`  ↳ app_metadata.app_user_id = ${u.id}`);
    }
  }
  console.log("Listo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
