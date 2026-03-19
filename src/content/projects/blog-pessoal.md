---
title: "Blog Pessoal"
description: "O próprio blog — construído com Astro, estética terminal, suporte a newsletter."
date: 2024-03-01
tags: ["astro", "typescript", "css"]
status: "active"
repo: "https://github.com/voce/blog"
url: "https://blog.voce.dev"
---

## Sobre o projeto

Esse é o repositório do próprio blog que você está lendo. Construído com Astro 5, Content Collections, e um design system terminal-aesthetic feito do zero.

## Stack

- **Astro 5** — framework principal
- **TypeScript** — tipagem em todo o projeto
- **CSS custom properties** — design tokens sem dependências
- **@astrojs/rss** — feed RSS automático

## Funcionalidades

- Posts em Markdown com frontmatter tipado via Zod
- Posts podem ser vinculados a projetos
- Sistema de tags com filtragem
- Feed RSS
- API endpoint `/api/newsletter-posts` para integração com serviços de email
- Scroll-triggered animations via IntersectionObserver

## Roadmap

- [ ] Syntax highlighting com Shiki
- [ ] View Transitions
- [ ] Integração com Resend para newsletter
- [ ] Search client-side com Pagefind
