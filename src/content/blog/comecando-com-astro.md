---
title: "Começando com Astro"
description: "Por que escolhi Astro para o meu blog e o que aprendi nos primeiros dias."
date: 2024-03-10
tags: ["astro", "web", "dev"]
newsletter: true
---

## Por que Astro?

Depois de passar por Gatsby, Next.js e Jekyll, finalmente encontrei uma ferramenta que não fica no meu caminho. O Astro tem uma filosofia simples: **zero JS por padrão**, só envia o que você precisa.

Para um blog, isso é o suficiente.

## O que me convenceu

A separação entre conteúdo e apresentação é muito clara. Você escreve em Markdown, define o frontmatter, e o resto é Astro resolvendo.

```bash
# estrutura mínima
src/
  content/
    blog/
      primeiro-post.md
  pages/
    blog/
      [slug].astro
```

O `Content Collections` com Zod valida tudo em build time — se você esquecer um campo obrigatório no frontmatter, o build quebra com uma mensagem clara. Isso é conforto.

## O que ainda estou aprendendo

View Transitions são promissoras mas ainda têm edge cases chatos. Vou escrever mais sobre isso quando tiver mais tempo com elas.
