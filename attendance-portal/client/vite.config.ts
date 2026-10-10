import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/.env': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/.git': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/wp-admin': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/actuator': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/config.json': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
