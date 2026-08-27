import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    __EXPLAIN_VISUALLY_ENV__: JSON.stringify(process.env.EXPLAIN_VISUALLY_ENV ?? 'development'),
  },
  server: {
    proxy: {
      '/add_scene': 'http://127.0.0.1:8787',
      '/render': 'http://127.0.0.1:8787',
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
