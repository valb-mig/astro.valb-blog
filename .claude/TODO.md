# TODO

Ver `TODO.md` na raiz do repo pra notas originais em prosa (brainstorm bruto
do refactor). Este arquivo é a versão estruturada/viva, cruzada com o estado
real do código.

## Pendente — antes de produção

- [x] Confirmar se as tabelas existem no Supabase real — confirmado em
      2026-07-08 (`posts`, `projects`, `source_events`, `post_events`,
      `post_projects` todas existem e têm dado real). `supabase-schema.sql`
      continua removido do repo (commit `236b660`), sem SQL versionado como
      fonte de verdade — qualquer schema novo precisa de migração manual
- [ ] Configurar `.env` de produção: Supabase URL/service key, `ADMIN_USERNAME`/
      `ADMIN_PASSWORD`, `SESSION_SECRET`, `GH_TOKEN`/`GH_USERNAME`, `GROQ_API_KEY`
- [ ] Atualizar `site` em `astro.config.mjs` (ainda `'https://fake'`)
- [x] Configurar secrets do GitHub Actions pro `.github/workflows/ingest.yml`
      (2026-07-10): `GH_TOKEN`, `GH_USERNAME`, `GROQ_API_KEY`, `GEMINI_API_KEY`,
      `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` setados via `gh secret set`
      com os valores do `.env` local
- [x] Reescrever `CLAUDE.md` (2026-07-10) — reflete arquitetura real
      (SSR+Supabase, Tailwind v4+shadcn/ui, Geist, ingest via git log,
      reações/comentários/wakatime/atividade/language badges). CONTEXT.md
      também atualizado (seções "Estado atual" e decisões)

## Refactor grande — activity feed (decisões já tomadas, ver CONTEXT.md)

- [x] Página de atividade — feed do que o usuário está fazendo, baseado em
      `source_events`/posts gerados pelo ingest (2026-07-10): rota `/atividade`,
      componente `ActivityItem.astro`, agrupado por dia UTC, paginado
      (`?page=`), link no Header
- [x] Reações com emoji em posts (2026-07-10): tabela `post_reactions`
      (`post_id, emoji, fingerprint` unique), `src/lib/reactions.ts` (hash
      sha256 ip+ua+salt via `REACTION_SALT`), API `src/pages/api/reactions.ts`
      (GET conta+reacted, POST faz **toggle** liga/desliga), island
      `ReactionBar.tsx` em `blog/[slug].astro`. Set fixo de 5 emojis
      (👍❤️🔥🎉👀). Rate-limit em memória por fingerprint (10 toggles/min,
      `reactionRateLimitExceeded` em `reactions.ts`) pra travar clique
      repetido/script — reseta em cold start (serverless), aceitável, só
      precisa frear rajada
      **Bug corrigido (2026-07-10):** `ReactionBar.tsx` importava de
      `reactions.ts`, que usa `crypto` (Node, server-only) — Vite externaliza
      no browser e quebra a hidratação do React (clique não fazia nada).
      Separado `REACTION_EMOJIS` pra `src/lib/reaction-emojis.ts` (sem
      dependência de Node), client importa só de lá
- [x] ~~Comentários anônimos em posts~~ — implementado e **revertido no mesmo
      dia** (2026-07-10). Motivo: usuário não quer lidar com moderação
      (nomes ofensivos, spam, bots de propaganda) — escopo indesejado, não
      bug. Removidos `CommentSection.tsx`, `api/comments.ts`,
      `api/comments/[id].ts`, referência em `blog/[slug].astro`. Tabela
      `post_comments` precisa de `drop table` manual no Supabase (SQL
      passado ao usuário, não versionado). **Não reabrir sem pedido
      explícito** — reações emoji continuam (menor superfície de abuso, sem
      texto livre)
- [x] Widget Wakatime no topo do blog (2026-07-10): `WAKATIME_API_KEY` no
      `.env`, `src/lib/wakatime.ts` (fetch+cache 5min em memória),
      `api/wakatime.ts` (rota própria/proxy), `WakatimeWidget.astro` (SSR,
      sem client JS) no topo de `/blog` — total 7 dias + top 4 linguagens.
      Também adicionado na home (`/`), entre o hero e "posts recentes"
- [ ] Aba "Sobre mim" com fotos reais (usuário disse que manda depois; hoje
      é placeholder)
- [x] Anúncio de detecção de linguagens/stack de repositórios GitHub em
      `/projects` (2026-07-10): coluna `projects.languages` (jsonb),
      `syncProjectLanguages()` em `ingest.ts` (roda no cron diário via
      `listLanguages`), `LanguageBadges.astro` em `ProjectCard`/`[slug]`.
      Populado manualmente uma vez pra teste: 29/34 projetos (5 falharam,
      provável repo renomeado/deletado — não derruba a run)
- [x] Suporte a projetos pessoais fora do GitHub (2026-07-10): já funcionava
      ponta a ponta — admin (`/admin/projects/new`) não exige `repo`,
      API/DB/UI já tratam `repo: null` sem quebrar em lugar nenhum. Confirmado
      via teste real (criar+deletar projeto sem repo). Sync diário do
      `ingest.ts` continua GitHub-only por design (não mexe em projetos
      manuais)
- [x] Posts vinculados a commits/issues/PRs específicos + embed de imagem
      (2026-07-10): sem tabela nova — `MarkdownEditor.astro` ganhou toolbar
      "+ evento" (dialog lista `source_events` do(s) repo(s) do projeto
      vinculado via `api/events.ts`, admin-only, insere blockquote+link
      markdown no cursor) e "+ imagem" (prompt de URL/alt, sem upload —
      não há storage configurado). Só em `admin/posts/[id].astro`
      (edição); `new.astro` sem repos ainda (projeto só existe após 1º save)
- [x] Trocar fonte de dados do ingest: GitHub API → `git log` local
      (2026-07-10): `syncRepoMirror`/`fetchCommitsFromGitLog` em `ingest.ts`
      — mirror bare em `.ingest-cache/` (`--depth 100`, não `--shallow-since`:
      bate em bug do git client contra o smart-HTTP do GitHub, "error
      processing shallow info: 4"). Removido `fetchPushCommits` e
      `listEventsForAuthenticatedUser`; só `type: commit` sobrevive —
      issue/PR/release não são mais capturados (de propósito, confirmado).
      Testado local (`--force --date=2026-07-09`): 9 commits novos via git
      log, dedupe correto com eventos antigos da API (mesmo sha)

- [x] Rota `/blog` renomeada pra `/posts` (2026-07-10) — nome não fazia
      sentido no nav. `src/pages/blog/` → `src/pages/posts/` (`git mv`),
      todos os links internos atualizados (Header, PostCard, ProjectGraph,
      projects/[slug], admin/posts, command-items, rss.xml). Widget Wakatime
      tirado de `/posts`, fica só na home (dentro do hero/bio)

## Ideias / backlog (sem compromisso)

- [x] Cron do ingest ajustado pra `55 23 * * *` (fim do dia UTC) e janela de
      busca trocada de rolling 24h pra dia calendário UTC (2026-07-09) —
      consistente com `todayStart`/slug `atividade-YYYY-MM-DD` que já usavam
      dia UTC. Decisão explícita do usuário: manter tudo em UTC em vez de
      BRT pra não precisar tocar em todayStart/slug/título do post também.
- [ ] Tags/hashtags — conceito antigo foi descartado, versão nova ainda não
      definida (usuário pediu pra ignorar por enquanto)
- [ ] Log de `main()` em `scripts/ingest.ts` às vezes imprime "N evento(s)
      novo(s)" com N = total de eventos já existentes (não só os novos de
      fato) — parece comportamento do `upsert+ignoreDuplicates+select` do
      Supabase, não é determinístico. Não afeta o conteúdo do post (sempre
      reconstruído via `post_events`), só a mensagem de log fica imprecisa
      às vezes. Investigar se incomodar.

## Feito recentemente (contexto, não ação)

- [x] Migração de content collections estáticas → SSR + Supabase (`f23cb19`)
- [x] Pipeline de ingest GitHub → Groq → Supabase via GH Actions (`d8ef3f9`)
- [x] Adição de Tailwind v4 + React + shadcn/ui (`e356b5f`)
- [x] CommandMenu (Ctrl+K) via React/shadcn substituindo CommandPalette antigo (`e190aa1`)
- [x] Refactor de componentes/páginas restantes pra shadcn/ui + DeleteButton (`9e66a88`)
- [x] Remoção do `supabase-schema.sql` do repo (`236b660`) — ver pendência acima
- [x] Reescrita do `scripts/ingest.ts` (2026-07-08): parse de conventional
      commits, dedup merge-commit×PR, agrupamento por repo, parágrafo por
      repo via Groq (JSON estruturado) com detecção de projeto novo +
      descrição real do GitHub, commits movidos pra bloco `<details>`
      colapsável, flag `--force` pra rebuild manual
- [x] Post↔Projeto N:N via `post_projects` (2026-07-08) — substitui
      `posts.project` (slug único); API de posts aceita/retorna `projectIds`
- [x] Componente `MultiSelect` (Command+Dialog+Badge) substituindo inputs de
      texto livre de tags/projeto no admin de posts (2026-07-08)
- [x] Sync diário de projetos do GitHub em `scripts/ingest.ts` (2026-07-08)
      — cria projeto novo por repo sem registro ainda, nunca sobrescreve
      existente; 44 projetos sincronizados na primeira run
