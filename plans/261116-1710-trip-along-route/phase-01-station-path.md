# Phase 01 — Đổi path trạm sang `/station/*`

**Goal:** Link trạm có dạng `/station/<entityId>-<slug>`. Worker phục vụ preview cho `/station/*`, và chuyển 301 mọi `/tram/<rest>` sang `/station/<rest>` (giữ query) để link/QR cũ vẫn mở được.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/lib/stationUrl.ts` | MODIFY — `stationPath`, `parseStationId`, comment đầu file |
| `worker/index.ts` | MODIFY — route `/station/*`, 301 `/tram/*` |
| `wrangler.jsonc` | MODIFY — `run_worker_first` thêm `/station/*` (giữ `/tram/*`) |
| `src/App.tsx` | MODIFY — comment `/tram` → `/station` |
| `src/data/types.ts` | MODIFY — comment `seo` |
| `public/robots.txt` | MODIFY — comment |
| `builder/run-local.mjs`, `.github/workflows/build-data.yml` | MODIFY — chỉ comment |
| `README.md` | MODIFY — mục "Link trạm & chia sẻ" |

`CHANGELOG.md` / `src/data/changelog.ts` của bản 0.4.0 **giữ nguyên** (lịch sử); ghi chú đổi path vào 0.5.0 ở phase 05.

## 2. `src/lib/stationUrl.ts`

```ts
/** Tiền tố path trạm. `/tram/*` cũ vẫn được Worker 301 về đây. */
export const STATION_PREFIX = '/station/'

export function stationPath(st: { entityId: string; name: string }): string {
  const slug = slugify(st.name)
  return `${STATION_PREFIX}${st.entityId}${slug ? `-${slug}` : ''}`
}

/** Lấy entityId từ pathname `/station/<id>-<slug>`. Không khớp thì null. */
export function parseStationId(pathname: string): string | null {
  const m = /^\/station\/(\d+)(?:-[^/]*)?\/?$/.exec(pathname)
  return m ? m[1] : null
}
```

## 3. `worker/index.ts`

```ts
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/data/')) return serveData(url, env)
    // Path cũ (QR đã in, link đã gửi) -> path tiếng Anh. 301 để trình duyệt/bot nhớ luôn.
    if (url.pathname === '/tram' || url.pathname.startsWith('/tram/')) {
      const rest = url.pathname.slice('/tram'.length)
      return Response.redirect(new URL('/station' + rest + url.search, url).toString(), 301)
    }
    if (url.pathname.startsWith(STATION_PREFIX)) return serveStation(url, env)
    return env.ASSETS.fetch(req)
  },
}
```

Lưu ý: `serveStation` đã 301 slug lệch về `stationPath(...)`, nên `/tram/123-sai-slug` → `/station/123-sai-slug` → `/station/123-dung-slug` (hai bước, chấp nhận được).

## 4. `wrangler.jsonc`

```jsonc
"run_worker_first": ["/data/*", "/station/*", "/tram/*"]
```

## 5. Acceptance criteria

- [ ] `npx tsc -b` pass.
- [ ] `npm run build` pass.
- [ ] `npx wrangler dev` (R2 local đã seed theo README): `curl -sI http://127.0.0.1:8787/tram/<id>-x` → `301`, `Location: /station/<id>-x`.
- [ ] `curl -s http://127.0.0.1:8787/station/<id>-<slug-đúng>` → 200, `<title>` là tên trạm, có `noindex`.
- [ ] Trong app (dev): mở một trạm → thanh địa chỉ là `/station/…`; QR "Link trạm" chứa `/station/…`.
- [ ] `grep -rn "/tram" src worker` chỉ còn đoạn redirect trong `worker/index.ts`.

## 6. Out of scope

- Đổi tên field `seo` / shard trong builder.
- Ghi changelog (phase 05).

## 7. Commit message dự kiến

```
feat(url): rename station path /tram/* to /station/*

stationPath/parseStationId now use /station/<id>-<slug>. Worker serves the
OG preview on /station/* and 301-redirects legacy /tram/* (keeps query) so
printed QR codes and shared links keep working.
```
