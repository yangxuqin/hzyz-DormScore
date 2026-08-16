import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 本地开发：前端跑在 5173，/api 代理到 wrangler dev 的 8787
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
