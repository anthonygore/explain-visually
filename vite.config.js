import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/add_scene': 'http://127.0.0.1:8787',
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
