# valb-blog

Blog pessoal e mini-CMS: posts, projetos e um post diário de "atividade" gerado
automaticamente a partir dos commits do dia.

## Stack

- **Astro 5** em SSR (`@astrojs/vercel`) + **React 19** nas islands
- **Supabase** (Postgres) como banco
- **Tailwind CSS 4** + **shadcn/ui**
- **Groq / Gemini** pra narrativa do post de atividade
- **GitHub Actions** pro ingest diário

## Arquitetura

Hexagonal, com o domínio isolado de framework:

```
src/
  core/     entidades, ports e services (sem Astro, Supabase ou Octokit)
  infra/    adapters: Supabase, GitHub, git, LLM, Wakatime, crypto
  app/      composition root (app.*) e helpers HTTP
  pages/    páginas e rotas de API — adapters finos sobre app.*
  components/, layouts/, lib/   UI
scripts/ingest.ts               entrada do ingest diário
```

Decisões e porquês ficam em `.claude/CONTEXT.md`.

## Rodando

```bash
pnpm install
cp .env.example .env   # preencha as variáveis
pnpm dev               # http://localhost:4321
```

| Script | O que faz |
|---|---|
| `pnpm check` | typecheck (`astro check`) |
| `pnpm test` | testes do core com repositórios em memória (vitest) |
| `pnpm build` | build SSR |
| `pnpm ingest:local` | roda o ingest com o `.env` local (`-- --date=YYYY-MM-DD`, `-- --force`) |

## Ingest

`.github/workflows/ingest.yml` roda todo dia: sincroniza repos do GitHub em
projetos, atualiza linguagens/CI/release/uptime, lê os commits do dia via
`git log` (mirror bare em `.ingest-cache/`) e reconstrói o post
`atividade-YYYY-MM-DD`. Sem commit mencionável no dia, usa o tempo de código
do Wakatime.

## Status de outros projetos

`.github/workflows/report-status.yml` é reutilizável: outros repos chamam no
próprio deploy pra reportar versão/build/env (o que a API do GitHub não
expõe), e isso aparece no status em `/about`.

```yaml
jobs:
  report-status:
    uses: valb-mig/astro.valb-blog/.github/workflows/report-status.yml@main
    with:
      site_url: https://SEUDOMINIO
      project_id: <uuid da linha em projects>
      payload: '{"version":"${{ github.sha }}","env":"production","url":"https://meuprojeto.com"}'
    secrets:
      status_token: ${{ secrets.STATUS_TOKEN }}
```

O `status_token` sai do botão "gerar novo" no form de edição do projeto
(`/admin/projects/[id]`) e fica como secret no repo consumidor.
