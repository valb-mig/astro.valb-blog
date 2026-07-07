# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # dev server at localhost:4321
pnpm build      # static build → dist/
pnpm preview    # preview built output
```

No test suite, no linter configured.

## Architecture

Static Astro 5 blog with two content collections (`blog`, `projects`). Output is fully static except `GET /api/newsletter-posts` — that endpoint is SSR-style but still pre-rendered at build time.

### Content collections (`src/content/`)

Defined in `src/content/config.ts` with Zod schemas.

**blog** frontmatter:
- `title`, `description`, `date` (required)
- `tags: string[]` — used for tag filtering on `/blog`
- `draft: boolean` — excluded from all queries when `true`
- `newsletter: boolean` — marks post for `/api/newsletter-posts`
- `project: string` (optional) — links post to a project slug

**projects** frontmatter:
- `title`, `description`, `date` (required)
- `status: 'active' | 'completed' | 'archived'`
- `repo`, `url` (optional URLs)
- `draft: boolean`

### Routing

| Route | File |
|---|---|
| `/` | `src/pages/index.astro` |
| `/blog` | `src/pages/blog/index.astro` — tag filter via `?tag=` query param |
| `/blog/[slug]` | `src/pages/blog/[slug].astro` |
| `/projects` | `src/pages/projects/` |
| `/about` | `src/pages/about.astro` |
| `/rss.xml` | `src/pages/rss.xml.ts` |
| `/api/newsletter-posts` | `src/pages/api/newsletter-posts.ts` |

### Layouts

`Base.astro` — wraps all pages: injects global CSS, Header, Footer, OG meta, RSS link, and scroll-fade IntersectionObserver. All pages pass `title` and optionally `description` / `og` props.

`Post.astro` — wraps blog post pages, uses `Base.astro` internally.

### Styling

Zero CSS framework. All design via CSS custom properties defined in `src/styles/global.css`:

```
--bg: #09090b        (page background)
--surface: #18181b   (cards/panels)
--border: #27272a
--text: #f4f4f5
--muted: #a1a1aa
--subtle: #52525b
--accent: #34d399    (green, links/highlights)
```

Font: JetBrains Mono (Google Fonts). Terminal/CLI aesthetic throughout — prompts styled as shell commands, headers as `# heading`.

Scroll animations use `.fade-in` + `.visible` classes triggered by IntersectionObserver in `Base.astro`.

### Newsletter integration

`GET /api/newsletter-posts` returns JSON of posts where `newsletter: true` OR tag `newsletter`. Accepts `?since=<ISO date>` to filter by date.

`src/lib/newsletter.ts` has `fetchNewsletterPosts()` and `formatPostsAsEmail()` helpers — intended for a future cron job (GitHub Actions / Vercel Cron) that calls the API and sends via Resend, Loops, or Buttondown.

### Site URL

`astro.config.mjs` has `site: 'https://fake'` — update before deploying to production. Canonical URLs and RSS feed depend on this.
