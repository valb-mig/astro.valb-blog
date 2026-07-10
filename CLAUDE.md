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

| Route | File |
|---|---|
| `/` | `src/pages/index.astro` |
| `/posts` | `src/pages/posts/index.astro` — tag filter via `?tag=` (route renamed from `/blog` on 2026-07-10, "blog" didn't fit the nav naming) |
| `/posts/[slug]` | `src/pages/posts/[slug].astro` — reactions below content |
| `/atividade` | `src/pages/atividade/index.astro` — paginated feed of `source_events`, grouped by UTC day |
| `/projects`, `/projects/[slug]` | `src/pages/projects/` — language/stack badges per repo |
| `/projects/graph` | interactive project↔post graph |
| `/about` | `src/pages/about.astro` |
| `/rss.xml` | `src/pages/rss.xml.ts` |
| `/admin/*` | login, posts (list/new/edit), projects (list/new/edit) — gated by `src/middleware.ts` |
| `/api/posts`, `/api/projects` (+ `[id]`) | CRUD, public GET filters `draft=false`, admin sees all |
| `/api/reactions` | anonymous, fingerprint-based, toggles a reaction on/off |
| `/api/events` | admin-only, lists `source_events` for a repo (used by the post editor's "+ evento" embed picker) |
| `/api/wakatime` | proxy + 5min in-memory cache for Wakatime stats — widget lives on the home hero only, not `/posts` |
| `/api/auth/login`, `/api/auth/logout` | admin session (HMAC-signed cookie, `src/lib/auth.ts`) |

### Ingest pipeline (`scripts/ingest.ts` + `.github/workflows/ingest.yml`, daily cron `55 23 * * *` UTC)

1. Syncs new GitHub repos into `projects` (never overwrites existing rows — manual admin edits survive reruns)
2. Refreshes `projects.languages` for every project with a `repo` set (`octokit.repos.listLanguages`)
3. For each public owned repo: bare-mirrors it into `.ingest-cache/` (`git clone/fetch --depth 100` — **not** `--shallow-since`, which hits a git-client bug against GitHub's smart-HTTP: "error processing shallow info: 4"), then reads `git log` for the target date's commits
4. Upserts new `source_events` (dedupe by sha), rebuilds the day's "atividade" post from **all** linked events (not just the new batch) via two LLM calls (day-level paragraph + per-repo JSON paragraph) — provider is pluggable (`src/lib/llm.ts`: Groq or Gemini, auto-falls-back Gemini→Groq on error if `GROQ_API_KEY` is set)

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
