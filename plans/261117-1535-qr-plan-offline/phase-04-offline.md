# Phase 04 — Dùng được khi offline

**Goal:** vite-plugin-pwa generateSW. Precache shell (js/css/html/svg/png/woff2). Runtime cache: `/data/base-*`, `/data/power-*` CacheFirst; `/data/manifest.json` NetworkFirst; ô bản đồ / style / glyph / sprite của tiles.openfreemap.org StaleWhileRevalidate (giới hạn số mục); `/api/route`, `/api/maps-link`, `/api/geocode`, `/api/revgeocode`, `/api/drive` NetworkFirst (timeout ngắn, giữ 7 ngày); live / reviews / station NetworkOnly. navigateFallback `index.html` (trừ /api, /data). Chip "Đang offline" khi `navigator.onLine === false`.

| File | Action |
|---|---|
| `package.json` | MODIFY — devDependency `vite-plugin-pwa` |
| `vite.config.ts` | MODIFY — VitePWA({ manifest: false, registerType: 'autoUpdate', workbox: {...} }) |
| `src/main.tsx` | MODIFY — đăng ký SW (virtual:pwa-register) |
| `src/vite-env.d.ts` | MODIFY nếu cần — types `vite-plugin-pwa/client` |
| `src/ui/OfflineBadge.tsx` + `src/App.tsx` | CREATE/MODIFY — chip offline |

Acceptance: build ra `dist/sw.js`; Playwright: tải trang, mở hành trình, `context.setOffline(true)`, tải lại → bản đồ khu đã xem + ghim trạm + tuyến hiện; chip offline hiện.
