# Phase 01 — Tooling: typecheck worker, Vitest, CI

**Goal:** `npm run typecheck` kiểm cả `src/` lẫn `worker/`; `npm test` chạy Vitest (2 worker); workflow `ci.yml` chạy typecheck + test + build trên mỗi push/PR vào `main`. Chưa có test thật (một smoke test để runner không fail).

## 1. Files chạm vào

| File | Action |
|---|---|
| `worker/tsconfig.json` | CREATE |
| `tsconfig.json` | MODIFY (thêm `references`, giữ `include: ["src"]`) |
| `package.json` | MODIFY (scripts `typecheck`, `test`; devDep `vitest`) |
| `package-lock.json` | MODIFY (npm install) |
| `vitest.config.ts` | CREATE |
| `src/lib/format.test.ts` | CREATE (smoke test) |
| `.github/workflows/ci.yml` | CREATE |
| `.gitignore` | MODIFY nếu cần (`*.tsbuildinfo`) |

## 2. Chi tiết

### `worker/tsconfig.json`
```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"],
    "baseUrl": "..",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["./**/*.ts"]
}
```
Worker import `src/lib/stationUrl`, `src/i18n`, `src/data/types` — các file này không được dùng DOM API; nếu tsc báo lỗi DOM ở đó thì ghi lại, không thêm `"DOM"` vào lib.

### `package.json` scripts
```json
"typecheck": "tsc -b && tsc -p worker --noEmit",
"test": "vitest run --maxWorkers=2",
"test:watch": "vitest --maxWorkers=2"
```
(`--maxWorkers=2` đặt cứng trong script theo quy tắc máy — tránh treo máy.)

### `vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
    maxWorkers: 2,
    minWorkers: 1,
  },
})
```

### `.github/workflows/ci.yml`
```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: {}
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

## 3. Wiring notes

- Không đổi `npm run build` (vẫn `tsc -b && vite build`) để deploy hiện tại không đổi.
- Smoke test chỉ import `src/lib/format.ts` và assert 1 hàm hiện có — mục đích là chứng minh alias `@/` và runner chạy.

## 4. Acceptance criteria

- [ ] `npm run typecheck` exit 0 (cả src và worker).
- [ ] `npm test` exit 0, log cho thấy ≤ 2 worker.
- [ ] `npm run build` exit 0.
- [ ] Cố ý thêm lỗi type vào `worker/api.ts` → `npm run typecheck` fail (rồi hoàn tác).
- [ ] `ci.yml` hợp lệ YAML (chưa push thì ghi "chưa chạy trên GitHub").

## 5. Out of scope

ESLint, test thật (phase 02), sửa lỗi type nếu phát hiện ở worker (nếu có thì ghi và hỏi — agent audit đã chạy tsc trên worker: 0 lỗi).

## 6. Commit message dự kiến

```
chore(tooling): type-check worker, thêm Vitest và workflow CI

worker/tsconfig.json dùng @cloudflare/workers-types (không DOM); script
typecheck kiểm cả src và worker. Vitest chạy logic thuần, cố định 2 worker.
ci.yml chạy typecheck + test + build trên push/PR vào main.
```
