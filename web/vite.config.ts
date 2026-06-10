import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// During local `vite dev`, proxy API calls to the NestJS server so the
// frontend can use same-origin relative URLs (/api/v1) in every environment.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
