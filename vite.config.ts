import { defineConfig } from 'vite';

// base: './' keeps asset URLs relative so the build works under the
// GitHub Pages project path (plutoniumm.github.io/orb/) without extra config.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
});
