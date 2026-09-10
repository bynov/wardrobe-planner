import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { PAGES } from './site/pages.ts';

const pages = ['app/index.html', ...PAGES.map((p) => p.file)];

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((p) => [p.replace(/\/?index\.html$/, '') || 'index', resolve(import.meta.dirname, p)]),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'site/**/*.test.ts'],
    passWithNoTests: true,
  },
});
