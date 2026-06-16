// Timezone-aware date helpers. Pure functions, safe on both server and client.
//
// WHY THIS FILE EXISTS: the dashboard runs as Vercel serverless functions whose
// process timezone is UTC. So on the server `new Date().getDate()` (and friends)
// yields the *UTC* calendar day, not the user's. Anything that buckets events into
// "days" (study streak, the day headers in /history and /sessions) or computes
// "today" (SM-2 next-review / days_overdue) must be evaluated in the *user's* zone,
// which we persist in users.settings.timezone. These helpers make that explicit so
// "local" never silently means "whatever the server process is set to".

// Fallback used until a user's real timezone has been auto-detected (e.g. an
// MCP-only user who never opened the dashboard, or the first server render before
// the browser reports in). The dashboard overwrites it on the first authenticated
// visit. Change here if your typical user base lives elsewhere.
export const DEFAULT_TIMEZONE = "America/Mexico_City";

// Calendar day (YYYY-MM-DD) of an instant *as seen in `tz`*. Relies on Intl rather
// than manual offset math so it stays correct across DST transitions. en-CA emits
// ISO-style YYYY-MM-DD.
export function dayInTz(instant: Date | string, tz: string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Steps a YYYY-MM-DD string by whole days. Pure calendar arithmetic anchored in
// UTC (the string carries no time or zone), so DST never makes a day 23/25h here.
export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

// Wall-clock time (HH:MM, 24h) of an instant as seen in `tz`. Formatting with an
// explicit zone makes the server (UTC process) and the client (browser zone)
// produce the *same* string, avoiding React hydration mismatches.
export function timeInTz(instant: Date | string, tz: string, locale = "es-ES"): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// Human day label (e.g. "lunes, 16 de junio de 2026") for an already-resolved
// YYYY-MM-DD string. Anchors at noon UTC and formats in UTC so the printed date is
// exactly `day` with no off-by-one from a zone shift.
export function formatDayLabel(day: string, locale = "es-ES"): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Validates an IANA timezone id by asking Intl to build a formatter for it; an
// unknown zone throws a RangeError. Used to gate what clients may persist.
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
