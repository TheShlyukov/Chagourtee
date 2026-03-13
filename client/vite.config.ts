import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Create a custom plugin to handle WebSocket errors
const handleWebSocketErrors = () => ({
  name: 'handle-websocket-errors',
  configureServer(server) {
    server.httpServer?.on('upgrade', (req, socket, head) => {
      // Handle WebSocket upgrade requests
      // When the client disconnects abruptly, this will handle the connection cleanup gracefully
      socket.on('error', (err) => {
        if (err && (err as any).code === 'ECONNRESET') {
          // This is a normal disconnection event, don't log as error
          console.debug('WebSocket connection reset (normal during disconnection):', (err as any).code);
        } else {
          console.error('WebSocket error during upgrade:', err);
        }
      });
    });
  }
});

export default defineConfig({
  plugins: [react(), handleWebSocketErrors()],
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
        changeOrigin: true,
      },
    },
  },
});