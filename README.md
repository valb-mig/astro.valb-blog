# ~/blog

## Stack

- **Astro 5** + TypeScript
- **Content Collections** com validação Zod
- **CSS custom properties** — zero dependências de UI
- **@astrojs/rss** — feed RSS automático

---
## Newsletter

O endpoint `GET /api/newsletter-posts` retorna todos os posts marcados com `newsletter: true` ou com a tag `newsletter`, em JSON.

```bash
# todos os posts de newsletter
curl https://blog.voce.dev/api/newsletter-posts

# apenas posts desde uma data
curl "https://blog.voce.dev/api/newsletter-posts?since=2024-03-01"
```

---