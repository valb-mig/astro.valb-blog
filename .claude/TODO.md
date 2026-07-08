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
- [ ] Configurar secrets do GitHub Actions pro `.github/workflows/ingest.yml`
- [ ] Reescrever `CLAUDE.md` — descreve arquitetura antiga (content
      collections estáticas, sem Supabase, JetBrains Mono, CSS custom
      properties). Real hoje: SSR+Supabase, Tailwind v4+shadcn/ui, Geist.

## Refactor grande — activity feed (decisões já tomadas, ver CONTEXT.md)

- [ ] Página de atividade — feed do que o usuário está fazendo, baseado em
      `source_events`/posts gerados pelo ingest
- [ ] Reações com emoji em posts (fingerprint hash IP+UA, unique
      `(post_id, emoji, fingerprint)`)
- [ ] Comentários anônimos em posts (rate-limit na API, sem fingerprint unique)
- [ ] Widget Wakatime no topo do blog (rota própria com proxy + cache ~5min,
      sem entrar no pipeline de ingest)
- [ ] Aba "Sobre mim" com fotos reais (usuário disse que manda depois; hoje
      é placeholder)
- [ ] Anúncio de detecção de linguagens/stack de repositórios GitHub em
      `/projects`
- [ ] Suporte a projetos pessoais fora do GitHub (sem repo vinculado) — sync
      diário de `scripts/ingest.ts` só cria projeto pra repo real do GitHub
- [ ] Posts vinculados a commits/issues/PRs específicos (não só ao projeto)
      com embed de imagem no texto — decisão: sem tabela nova, resolvido só
      na UI do editor
- [ ] Trocar fonte de dados do ingest: GitHub API → leitura de `.git` local
      dos projetos (`git log`) — só `type: commit` sobrevive nessa troca

## Ideias / backlog (sem compromisso)

- [ ] Cron do ingest hoje roda 1x/dia (`0 3 * * *`) — decisão original era
      "atualizar sempre no fim do dia", confirmar se o horário faz sentido
      pro fuso do usuário
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
