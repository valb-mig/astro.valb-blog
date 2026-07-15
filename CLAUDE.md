# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For deeper context on decisions, pending work, and rationale, see `.claude/CONTEXT.md` and `.claude/TODO.md` — read those before starting non-trivial work here.

## Commands

```bash
pnpm dev              # dev server at localhost:4321
pnpm build            # SSR build → dist/ (Vercel adapter)
pnpm preview          # preview built output
pnpm ingest:local      # run the GitHub→LLM→Supabase ingest pipeline locally (reads .env)
pnpm ingest:local -- --force              # force-rebuild today's activity post even with no new events
pnpm ingest:local -- --date=YYYY-MM-DD    # run the pipeline for a past date instead of today
```

No test suite, no linter configured.

## Architecture

SSR Astro 5 blog/mini-CMS backed by Supabase (`output: 'server'`, `@astrojs/vercel`). Not static — posts and projects are edited live through `/admin`, and a GitHub Actions cron ingests daily commit activity into an auto-generated "atividade" blog post.

### Data (Supabase, `src/lib/db.ts`)

- **posts** — `title`, `description`, `content` (markdown), `date`, `tags: string[]`, `draft`, `reading_time`
- **projects** — `title`, `description`, `content` (GitHub README when synced), `date`, `tags`, `status: 'active'|'completed'|'archived'`, `repo` (`owner/name`, nullable — non-GitHub personal projects are supported), `languages` (jsonb, `{lang: percent}`, refreshed daily by ingest), `draft`, `parent_project_id`
- **post_projects** — join `post_id ↔ project_id` (many-to-many)
- **source_events** — event-sourcing table for GitHub activity: `type: 'commit'|'issue'|'pull_request'|'release'`, `external_id`, `repo`, `url`, `title`, `payload jsonb`, `occurred_at`. Unique `(source, type, external_id, repo)` for dedupe. **As of 2026-07-10, ingest only ever creates `type: 'commit'` rows** (read from local `git log`, not the GitHub Events API) — `issue`/`pull_request`/`release` rows still exist historically but are no longer produced.
- **post_events** — join `post_id ↔ event_id`, written only by the ingest pipeline
- **post_reactions** — `post_id, emoji, fingerprint` (unique triple) — anonymous emoji reactions, toggled on/off, deduped by a sha256 hash of IP+UA (`src/lib/reactions.ts`), plus an in-memory rate limit (10 toggles/min per fingerprint)

No SQL migrations are versioned in the repo (`supabase-schema.sql` was removed) — schema changes are applied manually in the Supabase dashboard.

### Routing

Admin isn't a separate app (as of 2026-07-15) — browsing pages (posts, projects,
atividade, about) are the same pages a visitor sees, just privilege-aware.
`Astro.locals.isAdmin` is computed once in `src/middleware.ts` for every
request (typed in `src/env.d.ts`) and read directly in pages/components —
no per-page cookie re-verification needed. `layouts/Admin.astro` is gone
entirely — every page (including the create/edit forms and the login page)
now shares the same visual language, `Base.astro`. When `isAdmin`, `Base.astro`
renders a fixed yellow border frame around the whole viewport (VSCode
debug-mode style, `pointer-events-none`) and the Header shows a yellow logout
button — the only persistent visual cue that you're in admin mode, since
otherwise the site looks identical to what a visitor sees. Settings, About,
and Updates config are all `Dialog` modals opened from the Header/`/about`,
not pages. The dashboard (stats + ingest trigger) isn't a page either; it
renders as admin-only boxes on `/` (home). Only `/admin/login` and the
create/edit forms remain as actual pages under `/admin/*` (forms are a
genuinely different UI — multi-field + `MarkdownEditor` — not just "more
data"; login is the one place `isAdmin` is still false).

| Route | File |
|---|---|
| `/` | `src/pages/index.astro` — admin-only: stats cards + "ingests recentes" + "rodar ingest agora" button |
| `/posts` | `src/pages/posts/index.astro` — tag filter via `?tag=`; admin sees drafts (badge on `PostCard`) + "+ novo post" |
| `/posts/[slug]` | `src/pages/posts/[slug].astro` — reactions below content; admin sees an editar/deletar toolbar + draft badge |
| `/atividade` | `src/pages/atividade/index.astro` — paginated feed of `source_events`, grouped by UTC day; admin gets a repo filter + delete per event |
| `/projects`, `/projects/[slug]` | `src/pages/projects/` — language/stack badges per repo; same admin treatment as posts (drafts, edit/delete on `ProjectCard` + detail toolbar, "+ novo projeto") |
| `/projects/graph` | interactive project↔post graph |
| `/about` | `src/pages/about.astro` — stack sections/items public; admin sees a "configurar" button opening a `Dialog` with `StackAdminPanel` (no more `/admin/about` page) |
| `/rss.xml` | `src/pages/rss.xml.ts` |
| `/admin/login` | session cookie only |
| `/admin/posts/new`, `/admin/posts/[id]` | create/edit forms, `Base.astro` layout |
| `/admin/projects/new`, `/admin/projects/[id]` | same as posts |
| `/api/posts`, `/api/projects` (+ `[id]`) | CRUD, public GET filters `draft=false`, admin sees all |
| `/api/reactions` | anonymous, fingerprint-based, toggles a reaction on/off |
| `/api/events` | admin-only, lists `source_events` for a repo (used by the post editor's "+ evento" embed picker) |
| `/api/icons/search`, `/api/icons/[slug]` | admin-only, icon search/lookup for the stack-item icon picker (`src/lib/simple-icons.server.ts`, backed by `@iconify-json/simple-icons`) |
| `/api/updates` (+ `[id]`) | GET public (paginated, `?before=`), POST/DELETE admin-only — backs `UpdatesAdminPanel.tsx` (opened as a modal from the Header, admin-only, no more `/admin/updates` page) |
| `/api/settings` | GET admin-only (also returns `hasGroqKey`/`hasGeminiKey` booleans, never the actual secrets), POST admin-only upsert — backs `SettingsAdminPanel.tsx` (modal from the Header gear icon, no more `/admin/settings` page) |
| `/api/wakatime` | proxy + 5min in-memory cache for Wakatime stats — widget lives on the home hero only, not `/posts` |
| `/api/auth/login`, `/api/auth/logout` | admin session (HMAC-signed cookie, `src/lib/auth.ts`) |

### Ingest pipeline (`scripts/ingest.ts` + `.github/workflows/ingest.yml`, daily cron `55 23 * * *` UTC)

1. Syncs new GitHub repos into `projects` (never overwrites existing rows — manual admin edits survive reruns)
2. Refreshes `projects.languages` for every project with a `repo` set (`octokit.repos.listLanguages`)
3. For each public owned repo: bare-mirrors it into `.ingest-cache/` (`git clone/fetch --depth 100` — **not** `--shallow-since`, which hits a git-client bug against GitHub's smart-HTTP: "error processing shallow info: 4"), then reads `git log` for the target date's commits
4. Upserts new `source_events` (dedupe by sha), rebuilds the day's "atividade" post from **all** linked events (not just the new batch) via two LLM calls (day-level paragraph + per-repo JSON paragraph) — provider is pluggable (`src/lib/llm.ts`: Groq or Gemini, auto-falls-back Gemini→Groq on error if `GROQ_API_KEY` is set)
5. **As of 2026-07-12, if `git log` finds zero commits for the day across every repo**, falls back to Wakatime (`getWakatimeSummaryForDate` in `src/lib/wakatime.ts`, the `summaries` endpoint — not the `stats/last_7_days` one the home widget uses) instead of leaving the day without a post. Same "atividade" post/slug/title, just a narrative built from time-coded + language data instead of commits — skipped entirely if Wakatime has no key configured or logged under 5 minutes that day (`WAKATIME_MIN_SECONDS` in `scripts/ingest.ts`). Requires `WAKATIME_API_KEY` in the ingest env too now (`.github/workflows/ingest.yml`), not just Vercel's.

### LLM provider (`src/lib/llm.ts`)

`getLlmProvider()` reads a `settings` table row (`llm_provider`, default `groq`) to pick Groq or Gemini. If Gemini is selected and it throws (API error, rate limit, outage), it automatically retries the same call on Groq — silent fallback, only if `GROQ_API_KEY` is present.

### Post editor (`src/components/MarkdownEditor.astro`)

CodeMirror-based split edit/preview, no upload backend. Toolbar has "+ evento" (only shown when the post has linked projects with a `repo` — opens a dialog listing that repo's `source_events`, inserts a markdown blockquote+link at the cursor) and "+ imagem" (prompts for a URL, no storage bucket exists — external URLs only).

### Styling

Tailwind CSS v4 + shadcn/ui (style `radix-nova`, base color `neutral`), tokens in `src/styles/global.css` (`oklch()` colors, single fixed dark theme, no light/dark toggle). Font: **Geist Variable** (`@fontsource-variable/geist`) — not JetBrains Mono. Minimalist/modern aesthetic (Vercel/Next.js-inspired), not the old terminal/CLI look.

Scroll animations use `.fade-in` + `.visible` classes triggered by an IntersectionObserver in `Base.astro`.

### Auth

`src/middleware.ts` blocks any `/admin/*` route without a valid session cookie. Credentials are fixed via env (`ADMIN_USERNAME`/`ADMIN_PASSWORD`), session is a custom HMAC-signed token (`src/lib/auth.ts`), no JWT library, 7-day cookie `maxAge`.

### Site URL

`astro.config.mjs` still has `site: 'https://fake'` — update before deploying to production; canonical URLs and RSS feed depend on it.
