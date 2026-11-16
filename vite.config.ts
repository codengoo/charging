import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Dữ liệu trạm ở `/data/*` (và chi tiết trạm `/api/*`) do Worker (worker/index.ts) đọc từ R2. Lúc `npm run dev` không có
 * Worker → chuyển tiếp `/data/*`, `/api/*` sang production (same-origin qua proxy nên không vướng CORS).
 * Đổi nguồn: `DATA_ORIGIN=http://127.0.0.1:8787 npm run dev` (chạy `wrangler dev` song song).
 */
const DATA_ORIGIN = process.env.DATA_ORIGIN ?? 'https://charging.cangao.asia'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/data': { target: DATA_ORIGIN, changeOrigin: true, secure: true },
      '/api': { target: DATA_ORIGIN, changeOrigin: true, secure: true },
    },
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
})
