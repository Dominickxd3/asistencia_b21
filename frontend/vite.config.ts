import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Puerto 4200: el backend (CORS_ORIGIN) y el WebSocket esperan este origen en desarrollo.
export default defineConfig({
  plugins: [react()],
  server: { port: 4200, strictPort: true },
  preview: { port: 4200, strictPort: true },
});
