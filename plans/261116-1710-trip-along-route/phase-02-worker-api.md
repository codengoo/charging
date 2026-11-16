# Phase 02 — Worker `/api/*`: proxy HERE + mở link rút gọn

**Goal:** Worker có 4 endpoint `GET /api/route`, `/api/geocode`, `/api/revgeocode`, `/api/maps-link`. Key HERE nằm trong secret `HERE_API_KEY`, không bao giờ xuống client. Endpoint chỉ nhận request cùng origin và bị rate limit 30 request / 60 s theo IP.

## 1. Files chạm vào

| File | Action |
|---|---|
| `worker/api.ts` | CREATE — handler `/api/*` |
| `worker/index.ts` | MODIFY — `Env` thêm `HERE_API_KEY`, `API_LIMIT`; route `/api/` |
| `wrangler.jsonc` | MODIFY — `run_worker_first` thêm `/api/*`; khối `ratelimits` |
| `vite.config.ts` | MODIFY — proxy `/api` giống `/data` |
| `.dev.vars.example` | CREATE — `HERE_API_KEY=` (mẫu; `.dev.vars` thật không commit) |
| `.gitignore` | MODIFY — thêm `.dev.vars` nếu chưa có |
| `README.md` | MODIFY — mục "API proxy HERE" (secret, dev) |

## 2. `wrangler.jsonc`

```jsonc
"assets": {
  ...
  "run_worker_first": ["/data/*", "/station/*", "/tram/*", "/api/*"]
},
// Giới hạn /api/* theo IP — chặn người ngoài dùng ké quota HERE. period chỉ nhận 10 hoặc 60.
"ratelimits": [
  { "name": "API_LIMIT", "namespace_id": "1001", "simple": { "limit": 30, "period": 60 } }
],
```

Secret: `npx wrangler secret put HERE_API_KEY` (user tự chạy; không ghi key vào repo/plan).

## 3. `worker/api.ts`

```ts
// /api/*: proxy HERE (giấu key) + mở link rút gọn Google Maps.
// Worker CHỈ làm I/O: body HERE được trả nguyên (stream), không parse — Free plan 10ms CPU.

export interface ApiEnv {
  HERE_API_KEY: string
  API_LIMIT: RateLimit
}

const SITE_HOSTS = new Set(['charging.cangao.asia', 'localhost', '127.0.0.1'])
const SHORTENERS = ['maps.app.goo.gl', 'goo.gl', 'g.co']
const MAX_VIA = 20
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36'

export async function serveApi(req: Request, url: URL, env: ApiEnv): Promise<Response> {
  if (req.method !== 'GET') return fail(405, 'Chỉ nhận GET')
  if (!sameSite(req)) return fail(403, 'Không cho phép')
  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown'
  const { success } = await env.API_LIMIT.limit({ key: ip })
  if (!success) return fail(429, 'Gọi quá nhanh, thử lại sau ít phút')

  switch (url.pathname) {
    case '/api/route': return route(url, env)
    case '/api/geocode': return geocode(url, env)
    case '/api/revgeocode': return revgeocode(url, env)
    case '/api/maps-link': return mapsLink(url)
    default: return fail(404, 'Not found')
  }
}

/**
 * Cùng origin. Trình duyệt KHÔNG gửi `Origin` cho fetch GET cùng origin, nên xét
 * `Sec-Fetch-Site` trước, rồi mới tới Origin/Referer (trình duyệt cũ).
 * Script tự làm giả được — rate limit mới là hàng rào thật.
 */
function sameSite(req: Request): boolean {
  const site = req.headers.get('Sec-Fetch-Site')
  if (site) return site === 'same-origin'
  const from = req.headers.get('Origin') ?? req.headers.get('Referer')
  if (!from) return false
  try { return SITE_HOSTS.has(new URL(from).hostname) } catch { return false }
}
```

Các handler:

- `route`: `stops` = `lat,lng;lat,lng;…`. Validate mỗi cặp bằng regex số, 2 ≤ n ≤ 2 + `MAX_VIA` (thừa thì cắt via). Gọi
  `https://router.hereapi.com/v8/routes?transportMode=car&origin=..&via=..(lặp)&destination=..&return=polyline,summary&spans=length,functionalClass&apiKey=..`.
  Trả `new Response(res.body, { status: res.ok ? 200 : 502, headers: json + Cache-Control: private, max-age=300 })`.
- `geocode`: `q` bắt buộc (≤ 200 ký tự). Có `at` hợp lệ → `discover.search.hereapi.com/v1/discover?at=&q=&lang=vi-VN&limit=1`; không có → `geocode.search.hereapi.com/v1/geocode?q=&in=countryCode:VNM&lang=vi-VN&limit=1`.
- `revgeocode`: `at` bắt buộc → `revgeocode.search.hereapi.com/v1/revgeocode?at=&lang=vi&limit=1`.
- `mapsLink`:
  - `url` bắt buộc, host phải thuộc `SHORTENERS`, nếu không thì 400.
  - Theo redirect bằng tay (`redirect: 'manual'`, tối đa 5 bước, User-Agent `MOBILE_UA`). Header `Location` nào là `google.<tld>/maps…` thì trả `{ url }` ngay.
  - Không có `Location` hợp lệ thì đọc tối đa 256 KB body, regex `https://www\.google\.[a-z.]+/maps/[^"'\\\s<>]+`, thay `&` → `&`.
  - Không ra gì thì trả 502 `{ error }`.
- Mọi lỗi mạng: `try/catch` → 502. Không log key: URL có `apiKey` **không** được `console.log`.

`fail(status, msg)` → `Response.json({ error: msg }, { status, headers: { 'Cache-Control': 'no-store' } })`.

## 4. `worker/index.ts`

```ts
interface Env extends ApiEnv {
  DATA: R2Bucket
  ASSETS: Fetcher
}
...
if (url.pathname.startsWith('/api/')) return serveApi(req, url, env)
```

## 5. `vite.config.ts`

```ts
proxy: {
  '/data': { target: DATA_ORIGIN, changeOrigin: true, secure: true },
  // /api/* cần secret HERE: chạy `wrangler dev` (có .dev.vars) rồi DATA_ORIGIN=http://127.0.0.1:8787.
  '/api': { target: DATA_ORIGIN, changeOrigin: true, secure: true },
},
```

## 6. Acceptance criteria

- [ ] `npx tsc -b` pass; `npx wrangler deploy --dry-run` pass (config hợp lệ, có `ratelimits`).
- [ ] `wrangler dev` có `.dev.vars` chứa key thật:
  - `curl -H "Sec-Fetch-Site: same-origin" "http://127.0.0.1:8787/api/route?stops=21.0278,105.8342;20.8449,106.6881"` → 200, có `routes[0].sections[0].polyline` và `spans`.
  - Không có header `Sec-Fetch-Site`/`Origin` → 403.
  - `Sec-Fetch-Site: cross-site` → 403.
  - `stops=abc` → 400; một điểm → 400.
  - `/api/geocode?q=Hồ Gươm` → 200, có `items[0].position`.
  - `/api/revgeocode?at=21.0278,105.8342` → 200, có `items[0].title`.
  - `/api/maps-link?url=https://example.com/x` → 400.
  - `/api/maps-link?url=<link maps.app.goo.gl thật user đưa>` → 200, `url` chứa `/maps/`. Nếu Google chặn từ máy local thì ghi lại kết quả, thử lại sau deploy.
- [ ] Gọi 31 lần trong 60 s → có response 429 (binding local có thể không enforce. Nếu vậy thì ghi "chưa kiểm tra được ở local").
- [ ] `grep -rn "apiKey" dist/` → không có (key không lọt vào bundle client).
- [ ] Regression: `/data/manifest.json`, `/station/*` vẫn chạy.

## 7. Out of scope

- Client gọi các endpoint này (phase 03).
- Cache response bằng Cache API.

## 8. Commit message dự kiến

```
feat(worker): add /api proxy for HERE routing/geocode and Maps short links

worker/api.ts proxies HERE Routing v8, discover/geocode and revgeocode with
the HERE_API_KEY secret (bodies streamed untouched to stay under the 10ms CPU
limit) and expands maps.app.goo.gl links server-side with a host allowlist.
Requests must be same-origin and are rate limited per IP (API_LIMIT, 30/60s).
```
