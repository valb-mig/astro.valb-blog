import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

export default defineConfig({
  site: 'https://fake', // TODO: update before deploying
  output: 'server',
  adapter: vercel(),
  integrations: [icon(), react()],
  vite: { plugins: [tailwindcss()] },
});