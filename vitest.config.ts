import type {} from 'vitest/config';
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    passWithNoTests: true,
  },
});
