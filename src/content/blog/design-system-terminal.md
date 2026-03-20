---
title: "Construindo o design system do blog"
description: "Como montei a identidade visual terminal-aesthetic e o que aprendi no processo."
date: 2024-03-15
tags: ["css", "design"]
project: "blog-pessoal"
newsletter: false
---

## A ideia

Queria um blog que parecesse um terminal — não como gimmick, mas como linguagem visual consistente. Sem gradientes, sem glassmorphism, sem fonte serif tentando parecer literário.

Só monospace, zinc escuro e um verde esmeralda usado com parcimônia.

## Tokens primeiro

Comecei pelos tokens de cor antes de qualquer componente:

```css
:root {
  --bg: #09090b;
  --surface: #18181b;
  --border: #27272a;
  --text: #f4f4f5;
  --muted: #a1a1aa;
  --accent: #34d399;
}
```

Com isso definido, qualquer componente novo já nasce coerente. Não preciso lembrar o hex do verde — uso `var(--accent)` e pronto.

## A regra do acento

O verde (`#34d399`) só aparece em três lugares: links ativos, cursor piscante e a primeira linha do prompt. Em qualquer outro contexto, uso `--muted` ou `--subtle`.

Isso faz o acento realmente acentuar algo.

## Próximo passo

Adicionar suporte a syntax highlighting com Shiki usando o tema `github-dark` — é o que mais combina com a paleta.
