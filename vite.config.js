import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { minify } from 'html-minifier-terser';

const outDir = resolve(import.meta.dirname, 'dist');

export default defineConfig({
  root: resolve(import.meta.dirname, 'src'),
  base: '/',

  plugins: [
    {
      name: 'minify-html',
      apply: 'build',
      async closeBundle() {
        const file = resolve(outDir, 'index.html');
        const html = await readFile(file, 'utf8');

        const result = await minify(html, {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true
        });

        await writeFile(file, result);
      }
    }
  ],

  build: {
    outDir,
    emptyOutDir: true
  }
});