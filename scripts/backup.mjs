// Logical backup: dumps every table to a timestamped JSON file under backups/.
// Run from packages/dashboard:  node scripts/backup.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(here, "..", ".env.local"), "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

const TABLES = [
  "topic_groups",
  "topics",
  "topic_subsections",
  "recalls",
  "recall_subsections",
  "quick_review_sessions",
  "quick_review_answers",
  "review_sessions",
  "review_session_slots",
];

const dump = {};
for (const t of TABLES) {
  const { data, error } = await supabase.from(t).select("*");
  if (error) {
    console.error(`✗ ${t}: ${error.message}`);
    process.exit(1);
  }
  dump[t] = data;
  console.log(`✓ ${t}: ${data.length} filas`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = join(here, "..", "..", "..", "backups");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `supabase-${stamp}.json`);
writeFileSync(outFile, JSON.stringify(dump, null, 2));
console.log(`\nBackup escrito en ${outFile}`);
