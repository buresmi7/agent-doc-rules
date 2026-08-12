import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    assetsInlineLimit: 16 * 1024 * 1024,
    cssCodeSplit: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
