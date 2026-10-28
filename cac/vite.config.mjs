import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root, envDir: root, cacheDir: `${root}.vite`, plugins: [react()],
  server: { host: '127.0.0.1', port: 5185, strictPort: true, fs: { strict: true, allow: [root, fileURLToPath(new URL('../node_modules', import.meta.url))] } },
  preview: { host: '127.0.0.1', port: 5185 },
  build: { outDir: `${root}dist`, emptyOutDir: true },
});
