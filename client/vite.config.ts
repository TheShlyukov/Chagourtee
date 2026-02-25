import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true, // Use boolean true instead of string 'all'
    proxy: {
      '/api': { 
        target: 'http://127.0.0.1:3000', 
        changeOrigin: true,
        secure: false // Accept self-signed certificates if needed
      },
      '/ws': { 
        target: 'ws://127.0.0.1:3000', 
        ws: true,
        changeOrigin: true
      },
    },
  },
});