import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://fake', // TODO: update before deploying
  output: 'server',
  adapter: vercel(),
  integrations: [icon()],
});
