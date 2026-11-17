# Phase 01 — useExpandOnScroll + áp vào drawer

**Goal:** Drawer điện thoại và bảng Dọc đường nâng/thu theo cuộn như plan §2–3.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/lib/useExpandOnScroll.ts` | CREATE — hook trả `{ expanded, bind }` (`bind` = onScroll/onTouchStart/onTouchMove/onWheel cho khung cuộn) |
| `src/components/ui/responsive-dialog.tsx` | MODIFY — nhánh mobile: khung cuộn gắn `bind`; DrawerContent `style.maxHeight` theo `expanded`, transition |
| `src/ui/TripPanel.tsx` | MODIFY — thân bảng gắn `bind`; section dùng biến `--sheet-max` (mobile), `sm:` giữ max-h cũ |

## 2. Hằng số

```ts
export const SHEET_COMPACT = '60dvh'
export const SHEET_EXPANDED = 'calc(100dvh - env(safe-area-inset-top) - 8px)'
```

## 4. Acceptance criteria

- [ ] `npx tsc -b`, `npm test` (Vitest, 2 worker), `npm run build` pass.
- [ ] Playwright 390×844 (dev server): mở "Gần tôi" → drawer ≤ 60% (≤ 507px); cuộn xuống 200px → drawer cao ≈ 836px; cuộn về 0 → về ≤ 507px.
- [ ] Dọc đường (route giả 3 tuyến): tương tự; màn 1280 không đổi (thẻ trái max-h cũ).
- [ ] Drawer nội dung ngắn (ví dụ Chia sẻ) không nâng.

## 6. Commit message dự kiến

```
feat(ui): drawer điện thoại nâng gần full khi cuộn, thu về khi cuộn lại tới top
```
