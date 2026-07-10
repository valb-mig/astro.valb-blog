# Contexto do Projeto

## O que é

Blog pessoal do valb (`valb-mig`). Deixou de ser blog estático com posts em
Markdown e virou um mini-CMS SSR: posts e projetos vivem no Supabase, editáveis
por uma área `/admin`, com objetivo final de virar um "activity feed" que se
alimenta sozinho da atividade de GitHub do usuário (commits/issues/PRs
normalizados por IA viram post de blog).

`CLAUDE.md` na raiz foi reescrito em 2026-07-10 pra refletir a arquitetura
atual (SSR+Supabase) — antes descrevia content collections estáticas.

## Stack

- **Astro 5**, `output: 'server'`, adapter `@astrojs/vercel@8.x` (fixo em v8:
  v10 exige Astro 6)
- **Supabase** (`@supabase/supabase-js`) — client usa `SERVICE_ROLE_KEY`, todo
  acesso a dados é server-side (nunca exposto ao browser)
- **Tailwind CSS v4** + **shadcn/ui** (style `radix-nova`, base color
  `neutral`) — ver `components.json` e `src/styles/global.css`
- **React 19** via `@astrojs/react`, ilhas pontuais (CommandMenu, DeleteButton,
  editor, `MultiSelect` — combobox de tags/projetos no admin, construído com
  Command+Dialog+Badge porque shadcn (style `radix-nova`) não tem multi-select
  nem Popover prontos)
- Fonte **Geist Variable** (`@fontsource-variable/geist`) — não mais
  JetBrains Mono
- Tema único dark fixo, cores em `oklch()`, sem toggle light/dark
- **CodeMirror** + **marked** + **marked-highlight**/**highlight.js** — editor
  de markdown e syntax highlight nos posts renderizados
- **Octokit** (`@octokit/rest`) + **Groq SDK** — pipeline de ingest de
  atividade GitHub
- Auth admin: cookie HMAC-signed caseiro (`src/lib/auth.ts`), sem JWT lib, sem
  bcrypt — credenciais fixas via env (`ADMIN_USERNAME`/`ADMIN_PASSWORD`)

## Arquitetura

### Dados (Supabase)
- `posts` — title, description, content, date, tags, draft,
  reading_time (não tem mais `project` — ver `post_projects`)
- `projects` — title, description, content (readme do repo quando sincronizado
  do GitHub), date, tags (topics do GitHub quando sincronizado), status
  (active/completed/archived), repo (`owner/name`, link pro GitHub é derivado
  disso — sem coluna `url` separada), draft, `parent_project_id` (self-FK
  para vincular projeto a projeto)
- `post_projects` — join many-to-many `post_id ↔ project_id` (um post pode
  se vincular a vários projetos). Substituiu a antiga coluna
  `posts.project` (slug único) em 2026-07-08; migração rodada manualmente
  no Supabase (sem SQL versionado no repo, ver decisão sobre
  `supabase-schema.sql` abaixo)
- `source_events` — event-sourcing genérico de atividade (`source`,
  `type: commit|issue|pull_request|release`, `external_id`, `repo`, `url`,
  `title`, `payload jsonb`, `occurred_at`); unique
  `(source, type, external_id, repo)` pra dedupe em reruns do cron
- `post_events` — join many-to-many `post_id ↔ event_id` (um post pode citar
  vários eventos)

Tipos TypeScript centralizados em `src/lib/db.ts`.

### Rotas
| Rota | Arquivo |
|---|---|
| `/` | `src/pages/index.astro` — hero + posts recentes + projetos ativos |
| `/posts`, `/posts/[slug]` | `src/pages/posts/` (renomeado de `/blog` em 2026-07-10) |
| `/projects`, `/projects/[slug]` | `src/pages/projects/` |
| `/about` | `src/pages/about.astro` |
| `/rss.xml` | `src/pages/rss.xml.ts` |
| `/admin/*` | login, posts (list/new/[id]), projects (list/new/[id]) — protegido por `src/middleware.ts` |
| `/api/posts`, `/api/posts/[id]` | CRUD posts (GET público filtra `draft=false`, admin vê tudo) |
| `/api/projects`, `/api/projects/[id]` | CRUD projects, mesma regra de draft |
| `/api/auth/login`, `/api/auth/logout` | sessão admin |
| `/api/command-items` | dados pro command palette (Ctrl+K) |

### Pipeline de ingest (GitHub → Groq → Supabase)
`scripts/ingest.ts` + `.github/workflows/ingest.yml` (cron diário `55 23 * * *`,
perto do fim do dia UTC + `workflow_dispatch` manual). Reescrito em 2026-07-08
pra sair do formato "parágrafo genérico + lista flat de referências" (robótico,
sem estrutura) pra um post estruturado por repo. Fluxo atual:

1. Busca eventos do dia (dia calendário UTC, `since` = 00:00 UTC de hoje —
   antes era janela rolante de 24h) via Octokit, upsert em `source_events`
   (dedupe por `source,type,external_id,repo`)
2. Pré-processamento determinístico (sem gastar token de LLM): parse de
   conventional commits (`feat`/`fix`/`docs`/...), dedup de commit
   `Merge pull request #N` contra o `PullRequestEvent` já mergeado
   correspondente, agrupamento por repo
3. **Post é sempre reconstruído a partir de TODOS os eventos do dia**
   (via join `post_events`), não só do batch da run atual — evita que uma
   segunda run no mesmo dia perca referências já linkadas
4. 2 chamadas Groq (`llama-3.3-70b-versatile`):
   - parágrafo geral do dia (mantém, tom corrido, cita só destaques
     release/PR merged, nunca commit individual)
   - **1 chamada só, `response_format: json_object`**, gera parágrafo curto
     por repo ativo — recebe contagem por tipo de commit, até 5 descrições
     reais de commit (`sampleDescriptions`), `isNewProject` (repo sem
     nenhum `source_event` anterior a hoje) e, se novo, a `description` real
     do repo no GitHub (via Octokit `repos.get`, só pros repos novos —
     baixo volume). JSON malformado degrada pra "sem parágrafo daquele
     repo" em vez de derrubar a run
5. Montagem final (código, sem LLM): `## repo` + parágrafo do Groq +
   subseções `### releases`/`### PRs`/`### issues` (só as que existirem) +
   bloco `<details>` no fim com a lista crua de todos os commits agrupados
   por repo — commits nunca aparecem citados na prosa
6. `pnpm ingest:local -- --force` força reconstrução do post do dia mesmo
   sem evento novo (útil pra testar mudança de prompt sem esperar atividade
   real). `--date=YYYY-MM-DD` sobrescreve "hoje" em todo o pipeline (janela
   de busca, slug `atividade-YYYY-MM-DD`, título do post, detecção de repo
   novo) — pra rodar a rotina manualmente num dia passado, ex.
   `pnpm ingest:local -- --date=2026-07-06 --force`
7. **Sync diário de projetos** (2026-07-08): antes de tudo isso, `main()`
   lista todos os repos do usuário via `octokit.paginate(repos.listForAuthenticatedUser)`
   e cria um projeto novo em `projects` pra cada repo sem registro ainda
   (match pela coluna `repo`). Nunca sobrescreve projeto existente — edição
   manual no admin sobrevive a reruns do cron. Roda sempre, com ou sem
   atividade nova.

Secrets necessários: `GH_TOKEN`, `GH_USERNAME`, `GROQ_API_KEY`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### Auth admin
`src/middleware.ts` bloqueia qualquer rota `/admin/*` (exceto `/admin/login`)
sem cookie de sessão válido. Sessão = HMAC-signed token custom
(`src/lib/auth.ts`), não expira automaticamente no servidor além do
`maxAge` do cookie (7 dias).

## Decisões importantes

- **SSR + Supabase em vez de content collections** — usuário queria
  criar/editar posts pelo próprio blog, sem editar `.md` local. (commit `f23cb19`)
- **`@astrojs/vercel@8.x` fixo** — v10 requer Astro 6; projeto está em Astro 5.
- **Event-sourcing genérico pra atividade** (`source_events`) em vez de
  schema GitHub-específico — permitiu trocar a fonte de dados sem migração
  (ver decisão de 2026-07-10 abaixo).
- **Ingest trocado de GitHub Events API pra `git log` local** (2026-07-10):
  `syncRepoMirror`/`fetchCommitsFromGitLog` em `ingest.ts`, mirror bare em
  `.ingest-cache/` (`--depth 100`, não `--shallow-since` — bug do git client
  contra o smart-HTTP do GitHub). Só `type: commit` sobrevive; issue/PR/release
  não são mais capturados (de propósito).
- **Sem Next.js** — decisão explícita de manter Astro; migrar seria overkill
  pra projeto solo/baixo tráfego e reescreveria middleware/auth/admin que já
  funciona.
- **Identidade visual fechada em 2026-07-07**: minimalista, dark, moderno,
  referência Vercel/Next.js (bordas arredondadas, pouca "decoração"). Substitui
  a estética terminal antiga. Tailwind v4 + shadcn/ui, fonte trocada pra Geist.
  **Essa decisão já foi implementada** (commits `e356b5f` → `236b660`) —
  diferente do que a memória anterior registrava.
- **Reações anônimas** (implementado 2026-07-10): fingerprint hash
  sha256(IP+UA+salt) em `src/lib/reactions.ts`; unique
  `(post_id, emoji, fingerprint)`; POST faz toggle (liga/desliga), rate-limit
  em memória (10 toggles/min por fingerprint) contra clique repetido/script.
- **Comentários anônimos: implementados e revertidos no mesmo dia**
  (2026-07-10) — usuário decidiu não lidar com moderação (nomes ofensivos,
  spam, bots de propaganda). `post_comments` foi dropada, código removido.
  Não reabrir sem pedido explícito do usuário.
- **Wakatime** (implementado 2026-07-10): sem storage, sem entrar no ingest —
  widget SSR com rota própria (`/api/wakatime`) fazendo proxy com cache em
  memória (~5min). Ficou primeiro em `/blog`, movido pra dentro do hero/bio
  da home em 2026-07-10 (usuário pediu, tirado do `/posts`).
- **Post↔Projeto N:N via tabela de junção** (2026-07-08) — em vez de array
  de slugs em `posts.project`, decisão explícita do usuário por
  normalização/query reversa mais fácil ("quais posts citam esse projeto").
- **Tags multi-select criável, sem tabela nova** — tags continuam `string[]`
  solto em `posts.tags`; "criar tag" no combobox é só adicionar ao array,
  sem persistir lista de tags em lugar nenhum.
- **Sync de projeto nunca sobrescreve existente** — só cria registro novo
  pra repo sem match; evita que o cron apague edição manual do usuário no
  admin.

## Estado atual

**Pronto:**
- Migração SSR+Supabase completa (schema, CRUD, auth admin)
- Pipeline de ingest via GH Actions: sync diário de projetos, refresh de
  `languages` por repo, leitura de `git log` local (não mais GitHub Events
  API), parágrafo por repo via LLM pluggable (Groq/Gemini com fallback)
- Refactor visual pra Tailwind v4 + shadcn/ui (componentes, Header, Footer,
  cards, CommandMenu, DeleteButton)
- Command palette (Ctrl+K) via `/api/command-items`
- Post↔Projeto N:N (`post_projects`) com multi-select no admin pra tags e
  projetos
- Página `/atividade` (feed paginado de `source_events`)
- Reações emoji em posts (toggle + rate-limit por fingerprint)
- Widget Wakatime na home (dentro do hero/bio, não mais em `/posts`)
- Badges de linguagem/stack por projeto em `/projects` (`projects.languages`)
- Suporte a projetos pessoais sem repo GitHub (já funcionava end-to-end,
  confirmado 2026-07-10)
- Editor de post: embed de evento específico (commit/issue/PR do repo
  vinculado) + embed de imagem por URL

**Em andamento / não confirmado como completo:**
- Tabelas do Supabase — sem SQL versionado no repo (`supabase-schema.sql`
  removido), tabelas novas (`post_reactions`, `post_comments`,
  `projects.languages`) criadas manualmente via SQL passado durante a sessão
- `.env` de produção (deploy/Vercel/secrets do GH Actions) — não verificado
- `site` em `astro.config.mjs` ainda é `'https://fake'`

**Não implementado ainda:**
- Aba "Sobre mim" com fotos reais — bloqueado, esperando o usuário mandar as
  fotos

**Ideia descartada:** publicação no Instagram — removida do escopo em
2026-07-08. Código do scaffold (`src/pages/api/instagram-post.ts`) ainda
existe no repo mas não faz mais parte do plano; considerar remover o arquivo
se ninguém for retomar.
