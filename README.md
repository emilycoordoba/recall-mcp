# Recall

A personal **active-recall** system that plugs into Claude Desktop. Claude explains a topic, quizzes you on what you remember, scores your answer, and Recall tracks how well you retain each topic over time — scheduling reviews with spaced repetition so you revisit things right before you'd forget them.

Built as a single Next.js app that is **both** the web dashboard and an **MCP server** (Model Context Protocol) that Claude Desktop talks to over HTTP.

---

## Why I built this

I study a lot with AI, and I kept hitting the same problem: a model can explain anything in seconds, but explanation isn't retention. I'd "understand" a topic in a chat and forget it a week later, with no record of what I'd actually learned or how well it stuck.

Recall closes that loop. The AI doesn't just teach — it tests me, scores me, and remembers the results so the *system* decides what I should review next, instead of me guessing.

---

## What it does

- **Turns explanations into measurable learning.** After Claude explains something, it stores a canonical table of contents, asks you to recall it freely, and scores each subsection (0–5).
- **Schedules reviews with SM-2 spaced repetition.** Each topic gets a next-review date based on your performance; the dashboard shows what's due and what's overdue.
- **Runs structured review sessions.** A review session is four purpose-built slots (most-urgent question, attack on persistently-failed material, maintenance of well-learned topics, and one full free recall).
- **Visualizes progress.** A Next.js dashboard shows every topic with its latest score, trend, group, and days until the next review.
- **Multi-user.** Each user authenticates with Supabase Auth; data is isolated at the database level with Row Level Security.

---

## How it works

```
Claude Desktop  ──HTTP (Bearer token)──▶  /api/mcp  ──▶  Supabase (Postgres)
                                                              ▲
                                          Dashboard (Next.js) ┘  (read-only)
```

The core learning loop:

```
1. Claude explains a topic
2. save_topic_subsections()  → stores the table of contents BEFORE asking you to recall
3. "What do you remember about X?"
4. You answer freely — no hints
5. Claude evaluates and gives feedback + a score per subsection
6. save_recall()             → persists transcript, feedback, and scores
7. The dashboard shows your progress; SM-2 schedules the next review
```

Storing the table of contents *before* the recall is deliberate: it becomes the source of truth to compare what you actually remembered against what the topic contains.

---

## Spaced repetition & review sessions

The scheduling logic is the heart of the project.

- **SM-2** computes each topic's next-review date. Only a **full recall** advances SM-2 — directed recalls and quick questions don't, because they don't prove full retention.
- A **review session has 4 slots**, each chosen from a different pool:

| Slot | Purpose | Picks the topic by |
|------|---------|--------------------|
| 1 | Most urgent | Highest `days_overdue` (with a 2-session cooldown) |
| 2 | Persistent failures | A subsection failed repeatedly (`times_missed ≥ 2`, `avg_score < 4`) |
| 3 | Consolidation | Well-learned but untouched for ≥ 7 days |
| 4 | Full recall | Longest since its last full recall — **the only slot that advances SM-2** |

A subsection drops out of the "weak" pools once it's `mastered` (≥ 5 sessions, `avg_score ≥ 4.5`, never missed). See [`docs/review-algorithm.md`](docs/review-algorithm.md) for the full ranking logic.

---

## Tech stack

- **Next.js 16** (App Router, Turbopack) — one app serving both the dashboard and the MCP endpoint
- **Model Context Protocol** — [`@modelcontextprotocol/sdk`](https://modelcontextprotocol.io) over Streamable HTTP, with Zod-validated tool schemas
- **Supabase** (Postgres) — data layer, **Supabase Auth** (email/password), **Row Level Security** on every table
- **shadcn/ui + Tailwind CSS v4**, `sonner` (toasts), `next-themes` (light/dark)
- **Vercel** — deployment; the MCP endpoint runs as a serverless function

---

## Architecture notes

A few decisions worth calling out:

- **The MCP server lives at `/api/mcp` using the Pages API, not the App Router.** The MCP SDK's Streamable HTTP transport needs the raw request/response without Next.js's body parser, which the App Router doesn't expose cleanly.
- **Two separate DB modules by intent:** `lib/db.ts` is read-only (dashboard) and `lib/db-mcp.ts` is write-only (MCP tools). Keeping them apart prevents the frontend from ever issuing writes.
- **RLS does the isolation, not application code.** The dashboard queries with the user's session so Postgres policies (`user_id = app_uid()`) enforce per-user access; the MCP server uses the `service_role` key but is already scoped to a user by its token.
- **Topic type is derived, never stored.** Each subsection is tagged theory/practice; the topic's type is computed on read, so there's no second source of truth to drift.

---

## Running locally

```bash
npm install
npm run dev          # dev server on http://localhost:3000 (Turbopack)
npm run build        # production build
npm run typecheck    # tsc --noEmit
```

### Environment variables

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Supabase connection |
| `MCP_API_KEY` | Bearer token Claude Desktop uses to authenticate to `/api/mcp` |
| `DASHBOARD_USER` / `DASHBOARD_PASS` | Basic auth for the dashboard |
| `NEXT_PUBLIC_SITE_URL` *(optional)* | Canonical site URL for metadata/OG/sitemap |

### Connecting Claude Desktop

Add the server to `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "recall-mcp": {
      "url": "<YOUR_VERCEL_URL>/api/mcp",
      "headers": { "Authorization": "Bearer <MCP_API_KEY>" }
    }
  }
}
```

Then copy the system prompt from `SYSTEM_PROMPT.md` (also viewable at `/prompt`) into Claude Desktop's custom instructions, and restart it.

---

## Project layout

```
app/                 — dashboard (App Router): landing, /app, /topics/[id], /sessions, /settings, /prompt
pages/api/mcp.ts     — MCP server over HTTP (Streamable, Pages API)
lib/mcp-server.ts    — MCP tool definitions (Zod schemas)
lib/db-mcp.ts        — Supabase writes (save_recall, get_review_plan, …)
lib/db.ts            — Supabase reads (dashboard, read-only)
lib/topic-kind.ts    — pure module: subsection kind + SM-2 ladder selection
docs/                — review-algorithm.md, app.md, multiuser.md
```
