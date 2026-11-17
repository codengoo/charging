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

## 4. Lệch so với kế hoạch (ghi lúc thực hiện)

- Bảng route nằm ngay trong `worker/index.ts` (`ROUTES`) thay vì `worker/routes.ts` — handler `/data/*`, `/station/*` ở đó, tách ra chỉ thêm vòng import. Guard (`checkGuard`, `sameSite`) ở `worker/http.ts`.
- Thêm `worker/manifest.ts` (`getManifest` cache theo isolate 60 s, `lookupSeoRow`).
- Builder vẫn là `.mjs` chạy Node thuần nên KHÔNG gọi được hàm TS: chỉ `// @ts-check` + JSDoc `import()` type từ `src/data/format.ts`; `builder/tsconfig.json` + `tsc -p builder` trong `npm run typecheck`. Định dạng cột groups giữ khớp bằng test khứ hồi `src/data/format.test.ts` (import thẳng `builder/lib/build.mjs`).
- Chưa chạy `node builder/run-local.mjs` thật (cần mạng tới VinFast) — thay đổi ở builder chỉ là ép kiểu `String()/Number()` trên giá trị vốn đã đúng kiểu và tách `groupsString`.
- Shard SEO thiếu nhưng manifest có `seo`: trước trả 404, nay 200 (coi như chưa có chỉ mục). Chỉ xảy ra khi build hỏng.
