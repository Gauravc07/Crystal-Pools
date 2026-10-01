// Admin panel build — a completely separate app from the public website.
// Its own entry (admin/index.html), its own output (dist-admin/), deployed on its own host.
// Nothing under admin/ is imported by the public site, so no admin code ships to visitors.
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: path.resolve(__dirname, 'admin'),
  envDir: __dirname,
  publicDir: path.resolve(__dirname, 'admin/public'),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(__dirname, 'dist-admin'),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  preview: {
    port: 4174,
  },
});
