import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const DAY = 24 * 60 * 60

/**
 * Service worker (Workbox) để mở app khi mất sóng: precache app shell; dữ liệu trạm `base-<gen>-<hash>`
 * / `power-…` bất biến → cache trước; `manifest.json` hỏi mạng trước (biết bản dữ liệu mới); ô bản đồ
 * OpenFreeMap đã xem → dùng cache ngay, cập nhật ngầm; API tuyến / link / địa chỉ → mạng trước, mất mạng
 * dùng bản đã lưu (mở lại hành trình vừa xem). Cổng trống thời gian thực, đánh giá: không cache.
 * Giữ public/manifest.webmanifest viết tay (manifest: false).
 */
const pwa = VitePWA({
  registerType: 'autoUpdate',
  injectRegister: null, // đăng ký trong src/main.tsx
  manifest: false,
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
    // Bundle chính ~1,5 MB (maplibre), sát ngưỡng mặc định 2 MB — nới để không rơi khỏi precache khi lớn thêm.
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//, /^\/data\//, /^\/admin/],
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/data/manifest.json',
        handler: 'NetworkFirst',
        options: { cacheName: 'data-manifest', networkTimeoutSeconds: 4 },
      },
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/data\/(base|power)-[\w-]+\.json$/.test(url.pathname),
        handler: 'CacheFirst',
        options: { cacheName: 'data', expiration: { maxEntries: 6 } },
      },
      {
        urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'map',
          expiration: { maxEntries: 4000, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // Ảnh vệ tinh Esri: nặng hơn ô bản đồ thường nhiều — cache vừa phải, không tải trước hàng loạt.
        urlPattern: ({ url }) => url.hostname === 'server.arcgisonline.com' || url.hostname === 'ibasemaps-api.arcgis.com',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'satellite',
          expiration: { maxEntries: 1000, maxAgeSeconds: 7 * DAY, purgeOnQuotaError: true },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/api\/(route|maps-link|geocode|revgeocode|drive)$/.test(url.pathname),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api',
          networkTimeoutSeconds: 8,
          expiration: { maxEntries: 200, maxAgeSeconds: 7 * DAY },
          cacheableResponse: { statuses: [200] },
        },
      },
    ],
  },
})

/**
 * Dữ liệu trạm ở `/data/*` (và chi tiết trạm `/api/*`) do Worker (worker/index.ts) đọc từ R2. Lúc `npm run dev` không có
 * Worker → chuyển tiếp `/data/*`, `/api/*` sang production (same-origin qua proxy nên không vướng CORS).
 * Đổi nguồn: `DATA_ORIGIN=http://127.0.0.1:8787 npm run dev` (chạy `wrangler dev` song song).
 */
const DATA_ORIGIN = process.env.DATA_ORIGIN ?? 'https://charging.cangao.asia'
/** Chỉ đổi nguồn `/api/*` (vd. thử endpoint Worker mới bằng `wrangler dev`), `/data/*` vẫn lấy production. */
const API_ORIGIN = process.env.API_ORIGIN ?? DATA_ORIGIN

export default defineConfig({
  plugins: [react(), tailwindcss(), pwa],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/data': { target: DATA_ORIGIN, changeOrigin: true, secure: true },
      '/api': { target: API_ORIGIN, changeOrigin: true, secure: true },
    },
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
})
