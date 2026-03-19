### Integração futura

1. Configure um cron job (GitHub Actions, Vercel Cron) para rodar semanalmente
2. Chame o endpoint com `?since=<última-data-de-envio>`
3. Use `src/lib/newsletter.ts` para formatar e enviar via Resend/Loops/Buttondown
