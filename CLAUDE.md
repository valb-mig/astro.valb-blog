# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For deeper context on decisions, pending work, and rationale, see `.claude/CONTEXT.md` and `.claude/TODO.md` — read those before starting non-trivial work here. Every "why" that used to live in code comments is in `.claude/CONTEXT.md`.

## Commands

```bash
pnpm dev              # dev server at localhost:4321
pnpm check            # astro check (typecheck)
pnpm test             # vitest — core services with in-memory fakes, no Supabase
pnpm build            # SSR build → dist/ (Vercel adapter)
pnpm preview          # preview built output
pnpm ingest:local      # run the GitHub→LLM→Supabase ingest pipeline locally (reads .env)
pnpm ingest:local -- --force              # force-rebuild the day's activity post even with no new events
pnpm ingest:local -- --date=YYYY-MM-DD    # run the pipeline for a past date instead of today
```

CI (`.github/workflows/check.yml`) runs `check`, `test` and `build` on every PR and push to `main`. No linter configured.

## Code standards

- **Layers** — `src/core` (entities, ports, services; never imports Astro, Supabase, Octokit or any SDK), `src/infra` (adapters implementing core ports; the only place that knows the DB's snake_case), `src/app` (composition root `app.*` + HTTP helpers). Pages and API routes are thin adapters over `app.*` — never call `db.from(...)` outside `src/infra/supabase`.
- **No comments** in code (TS, Astro, CSS, YAML). A non-obvious "why" goes to `.claude/CONTEXT.md`. The only exception is the `///` directives Astro needs in `src/env.d.ts`.
- **English, short names** in code — meaning comes from the folder (`core/post/service.ts` exports `Service`, `infra/supabase/posts.ts` exports `Posts`). UI copy, LLM prompts and public URLs (`/atividade`, `/manutencao`) stay pt-BR.
- **Entities are camelCase** everywhere above infra, including API JSON payloads (`readingTime`, `projects`, `sectionId`, `createdAt`…). React islands may `import type` from `@/core/...`, never from `@/app` or `@/infra`.
- **Errors** — services throw `Fault` (`src/core/error.ts`, codes `invalid|denied|missing|limited|upstream|config`); `route()` in `src/app/http.ts` maps them to HTTP status and handles the admin check (`route(fn, true)`).
- **Tests** — new core logic gets a vitest test with fakes from `src/test/` (`memory.ts` for CMS ports, `ingest.ts` for ingest ports).

## Architecture

SSR Astro 5 blog/mini-CMS backed by Supabase (`output: 'server'`, `@astrojs/vercel`). Not static — posts and projects are edited live through the admin, and a GitHub Actions cron ingests daily commit activity into an auto-generated "atividade" blog post.

```
src/core/    post, project, event, stack, update, reaction, setting, auth, run, time, llm, ingest, stats
src/infra/   supabase/*, github/{hub,dispatch,source}, git/log, llm/{groq,gemini}, wakatime, probe, crypto, icons
src/app/     index.ts (app.*), db.ts, env.ts, http.ts, ingest.ts
src/lib/     UI-only helpers: icons, toast, markdown, utils (shadcn)
```

### Data (Supabase, mapped in `src/infra/supabase/*`)

- **posts** — `title`, `description`, `content` (markdown), `date`, `tags: string[]`, `draft`, `reading_time`
- **projects** — `title`, `description`, `content` (GitHub README when synced), `date`, `tags`, `status: 'active'|'completed'|'archived'`, `repo` (`owner/name`, nullable — non-GitHub personal projects are supported), `languages` (jsonb, `{lang: percent}`, refreshed daily by ingest), `draft`, `parent_project_id`, `ingest_private`, `mention_allowed`, status fields (`ci_status`, `latest_release`, `uptime_url`, `last_status_code`, `status_token`, `deploy_status`… → `Project.health` in core)
- **post_projects** — join `post_id ↔ project_id` (many-to-many)
- **source_events** — event-sourcing table for GitHub activity: `type: 'commit'|'issue'|'pull_request'|'release'`, `external_id`, `repo`, `url`, `title`, `payload jsonb`, `occurred_at`. Unique `(source, type, external_id, repo)` for dedupe. **As of 2026-07-10, ingest only ever creates `type: 'commit'` rows** (read from local `git log`, not the GitHub Events API) — `issue`/`pull_request`/`release` rows still exist historically but are no longer produced.
- **post_events** — join `post_id ↔ event_id`, written only by the ingest pipeline
- **post_reactions** — `post_id, emoji, fingerprint` (unique triple) — anonymous emoji reactions, toggled on/off, fingerprint = sha256 of IP+UA+salt (`visitor()` in `src/app/http.ts`), plus an in-memory rate limit (10 toggles/min per fingerprint, `src/core/limit.ts`)
- **stack_sections / stack_items**, **updates**, **settings** (key/value), **ingest_runs**

No SQL migrations are versioned in the repo (`supabase-schema.sql` was removed) — schema changes are applied manually in the Supabase dashboard.

### Routing

Admin isn't a separate app — browsing pages (posts, projects, atividade, about) are the same pages a visitor sees, just privilege-aware. `Astro.locals.admin` is computed once in `src/middleware.ts` for every request (typed in `src/env.d.ts`) and read directly in pages/components and by `route()`. Every page uses `Base.astro`; when `admin`, it renders a fixed yellow border frame around the viewport (VSCode debug-mode style) and the Header shows a yellow logout button — the only persistent cue that you're in admin mode. Settings, About and Updates config are `Dialog` modals; the dashboard (stats + ingest trigger) renders as admin-only boxes on `/`. Only `/admin/login` and the create/edit forms are real pages under `/admin/*`.

| Route | File / service |
|---|---|
| `/` | `src/pages/index.astro` — latest posts/projects; admin: `app.stats.get()` + "rodar ingest agora" |
| `/posts`, `/posts/[slug]` | `app.posts.list/find/related`, reactions via `app.reactions.tally`; admin sees drafts + edit/delete |
| `/atividade` | `app.events.feed` (visitors only see events linked to a post — mentionable ones), heatmap from `app.posts.days` |
| `/projects`, `/projects/[slug]`, `/projects/graph` | `app.projects.list/find`, linked posts via `app.posts.list({ projects })` |
| `/about` | stack (`app.stack.sections`) + project status board (`app.projects.board`, `StatusCard`) |
| `/rss.xml` | `src/pages/rss.xml.ts` |
| `/admin/login`, `/admin/posts/*`, `/admin/projects/*` | login + create/edit forms |
| `/api/posts`, `/api/projects` (+ `[id]`) | CRUD, public GET hides drafts, admin sees all; bodies are core `Input` + `projects: string[]` for posts |
| `/api/projects/[id]/status` | external CI reports deploy status with `Authorization: Bearer <status_token>` (`report-status.yml`) |
| `/api/reactions` | `?post=` / `{ post, emoji }`, anonymous toggle |
| `/api/events` | admin-only, recent `source_events` for a repo (post editor "+ evento" picker) |
| `/api/icons/search`, `/api/icons/[slug]` | admin-only, `src/infra/icons.ts` (`@iconify-json/simple-icons`) |
| `/api/updates` (+ `[id]`), `/api/stack-*`, `/api/settings` | admin panels; settings GET also returns `hasGroqKey`/`hasGeminiKey`, never the secrets |
| `/api/ingest/orgs`, `/api/ingest/orgs/[org]/repos`, `/api/ingest/org-repos` | org opt-in (`src/core/ingest/orgs.ts`, settings keys `ingest_orgs`/`ingest_org_repos`); turning on a public org repo creates its project right away (`src/core/ingest/seed.ts`). Settings modal = tabs Geral / Repos / Organizações. Needs `GH_READ_TOKEN` in the web runtime (`src/infra/github/hub.ts`) — never the ingest's `GH_TOKEN` |
| `/api/admin/ingest-trigger` | dispatches `ingest.yml` (`GH_DISPATCH_TOKEN` + `GH_REPO`) |
| `/api/wakatime` | `app.time.week()` (5 min in-memory cache) — widget lives on the home hero |
| `/api/auth/login`, `/api/auth/logout` | admin session (`src/core/auth/service.ts` + HMAC in `src/infra/crypto.ts`) |

### Ingest pipeline (`scripts/ingest.ts` → `src/app/ingest.ts` → `src/core/ingest/run.ts`)

`.github/workflows/ingest.yml` runs daily at `0 3 * * *` UTC for the previous UTC day (`--date=yesterday`).

1. `Sync.projects` — creates a project for each new public GitHub repo (never overwrites existing rows). Sources: repos the user owns **plus** org repos opted in via the Settings modal. Private repos never become projects; private opted-in org repos are tracked in `source_events` but always non-mentionable
2. `Sync.languages` / `Sync.health` — refreshes `languages`, CI status, latest release and uptime for every tracked project
3. `Log.commits` (`src/infra/git/log.ts`) — bare mirror in `.ingest-cache/` (`--depth 100`, **not** `--shallow-since`), `git log` for the target day; repos not owned by `GH_USERNAME` get an author filter (noreply + verified account emails)
4. New `source_events` are saved; the day's "atividade" draft is rebuilt from **all** linked events via two LLM calls (day paragraph + per-repo JSON) — provider picked by `src/core/llm/pick.ts` (settings `llm_provider`, Groq default, Gemini falls back to Groq)
5. No mentionable commit that day → falls back to Wakatime coding time (`src/infra/wakatime.ts` `day()`, skipped under 5 minutes). Requires `WAKATIME_API_KEY` in the ingest env

Every run is recorded in `ingest_runs` (`src/infra/supabase/journal.ts`), shown on the home admin box.

### Post editor (`src/components/MarkdownEditor.astro`)

CodeMirror-based split edit/preview, no upload backend. Toolbar has "+ evento" (only when the post has linked projects with a `repo` — lists that repo's events, inserts a blockquote+link) and "+ imagem" (URL only, no storage bucket).

### Styling

Tailwind CSS v4 + shadcn/ui (style `radix-nova`, base color `neutral`), tokens in `src/styles/global.css` (`oklch()` colors, single fixed dark theme, no light/dark toggle). Font: **Geist Variable**. Minimalist/modern aesthetic (Vercel/Next.js-inspired). `src/components/ui/*` is shadcn-generated — leave it to the CLI.

Scroll animations use `.fade-in` + `.visible` classes triggered by an IntersectionObserver in `Base.astro`.

### Auth

`src/middleware.ts` sets `locals.admin` and blocks `/admin/*` without a valid session cookie. Credentials are fixed via env (`ADMIN_USERNAME`/`ADMIN_PASSWORD`), session is a custom HMAC-signed token, no JWT library, 7-day cookie `maxAge`, login rate-limited per IP.

### Deploy

`site` in `astro.config.mjs` is `https://valb-blog.vercel.app` (canonical URLs and RSS depend on it). As of 2026-11-23 the app is temporarily off Vercel and the Supabase project is unreachable; it is meant to return to Vercel, so the adapter stays.
