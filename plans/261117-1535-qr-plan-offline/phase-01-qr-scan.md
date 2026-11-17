# Phase 01 — Quét QR mở trạm

**Goal:** Nút QR cạnh ⚙ trong ô tìm kiếm mở bảng camera; quét được mã trạm thì đóng bảng và mở trạm.

## 1. Files chạm vào

| File | Action |
|---|---|
| `package.json` | MODIFY — thêm `qr-scanner` |
| `src/lib/stationUrl.ts` | MODIFY — `stationIdFromQr(text)`: nhận URL `/station/<id>` hoặc `/tram/<id>` (kể cả `/en/…`), chỉ host của app |
| `src/lib/stationUrl.test.ts` | MODIFY — test `stationIdFromQr` |
| `src/ui/QrScanSheet.tsx` | CREATE — AppSheet/ResponsiveDialog chứa `<video>`, nạp lười `qr-scanner`, báo lỗi quyền / không phải mã trạm / không tìm thấy trạm |
| `src/ui/SearchBar.tsx` | MODIFY — nút ScanQrCode cạnh ⚙ (`onScan`) |
| `src/App.tsx` | MODIFY — state mở bảng, `onFound` → `pick(station)` |

## 4. Acceptance criteria

- [ ] `npm run typecheck`, `npm test`, `npm run build` pass; `qr-scanner` nằm ở chunk riêng (nạp lười).
- [ ] Unit test: `https://charging.cangao.asia/station/123-ten` → `123`; `/en/station/123` → `123`; `/tram/456-x` → `456`; `https://maps.google.com/...` → null; `https://evil.com/station/1` → null; text thường → null.
- [ ] Playwright (camera giả: `--use-fake-device-for-media-stream` + file video chứa QR trạm): bấm nút QR → quét → bảng trạm mở đúng trạm.
- [ ] Từ chối quyền camera → hiện câu hướng dẫn.
