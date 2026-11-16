import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2019', chunkSizeWarningLimit: 600 },
  server: {
    port: 5173,
    host: true,
    proxy: { '/ws': { target: 'ws://localhost:8787', ws: true } },
  },
});
