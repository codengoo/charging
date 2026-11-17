# Phase 05 — Cấu trúc Worker + định dạng dữ liệu dùng chung

**Goal:** Một chỗ cho helper HTTP và guard route; định dạng manifest/SEO/power có type dùng chung builder ↔ worker ↔ client.

## 1. Files chạm vào

| File | Action |
|---|---|
| `worker/http.ts` | CREATE — `json(body, {status, cache})`, `fail`, `readJson`, `safeDecode` |
| `worker/routes.ts` | CREATE — bảng `{prefix, methods, guard, handler}`; guard = `sameSite` + limiter |
| `worker/{index,api,reviews,locator,evcs}.ts` | MODIFY — bỏ 4 bản `json/fail`, dùng `routes.ts`; `lookupSeoRow(env, id)` dùng chung; cache manifest theo isolate 60 s |
| `src/data/format.ts` | CREATE — `Manifest` (= `DataManifest`), `SeoRow`, `packPower`/`parsePower` (`"kw:count:dc\|…"`), thứ tự cột base/power |
| `src/data/types.ts`, `src/data/stations.ts` | MODIFY — dùng `format.ts` |
| `builder/lib/build.mjs`, `builder/run-local.mjs` | MODIFY — `// @ts-check` + JSDoc `@typedef {import('../../src/data/format')…}`, gọi `packPower` |
| `worker/http.test.ts`, `src/data/format.test.ts` | CREATE — pack/parse khứ hồi |

## 2. Acceptance criteria

- [ ] typecheck + test + build xanh.
- [ ] `node builder/run-local.mjs` ra file giống hệt bản trước (so sha256). Không chạy được do mạng → ghi "chưa kiểm tra".
- [ ] `wrangler dev`: curl mọi route (`/data/*`, `/station/*`, `/tram/*`, `/en/*`, `/api/route`, `/api/drive`, `/api/maps-link`, `/api/station/*`, `/api/reviews/*`, admin) cho cùng status/body như trước.

## 3. Commit message dự kiến

```
refactor(worker): gom helper HTTP và bảng route có guard; định dạng dữ liệu dùng chung builder/worker/client
```
