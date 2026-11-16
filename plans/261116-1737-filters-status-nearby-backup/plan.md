# Lọc công suất, trạng thái trạm, trạm gần nhất, sao lưu nhóm

**Date:** 2026-11-16 17:37 (ICT)
**Scope:** `builder/lib/`, `src/data/`, `src/map/`, `src/ui/`, `src/App.tsx`, docs (`README.md`, `CHANGELOG.md`, `src/data/changelog.ts`)
**Trigger:** Bốn tính năng đề xuất được chọn. (1) Lọc trạm theo công suất / DC và tô màu ghim theo mức kW, vì dữ liệu `power` đã tải mà chưa dùng để lọc. (2) Hiện trạng thái trạm (bảo trì, ngừng, chưa khai trương) ngay trên bản đồ: hiện ~2.800 trạm chưa khai trương đang được vẽ như trạm thường. (3) Danh sách trạm gần nhất. (4) Xuất / nhập nhóm đã lưu sang máy khác, vì nhóm chỉ nằm trong localStorage.

## 1. Goal

- Thanh chip trên bản đồ có thêm **Sạc nhanh DC**, **≥ 120 kW** (chọn một trong hai) và **Đang hoạt động**.
- Ghim trạm đổi màu theo mức: AC / chưa rõ (xanh lá như cũ), DC < 120 kW (xanh dương), DC ≥ 120 kW (tím). Ghim của trạm bảo trì / ngừng / chưa khai trương bị làm mờ. Bảng chi tiết trạm có nhãn trạng thái.
- Chip **Gần tôi** mở bảng 20 trạm gần nhất (theo GPS; không có GPS thì theo tâm bản đồ), áp đúng bộ lọc công suất đang bật, bỏ trạm không hoạt động.
- Bảng "Trạm sạc đã lưu" có nút **Sao lưu / chuyển máy**: QR + link `#import=…`, tải file `.json`, nhập từ file. Mở link `#import=…` thì hỏi xác nhận rồi **gộp** vào sổ nhóm hiện có.

## 2. Quyết định đã chốt (từ Q&A 1 vòng + kiểm dữ liệu thật)

| Câu hỏi | Lựa chọn |
|---|---|
| Nguồn trạng thái | Trường `charging_status` trong snapshot đầy đủ (có ở cả 25.017 trạm). File `sc` của `locators-meta.json` là **showroom/xưởng dịch vụ**, không dùng. |
| Mapping trạng thái (đối chiếu 12 trạm với `get-locator`) | `ACTIVE`→Available, `INACTIVE`→Maintaining, `UNAVAILABLE`→Planned (chưa khai trương), `OUTOFSERVICE`→OutOfService, `BUSY`→AllBusy. |
| Tần suất làm mới trạng thái | Theo bản build ngày (02:00), không thêm cron. |
| `BUSY` | **Bỏ**: build ngày làm "hết cổng trống" sai gần cả ngày. Builder ghi `BUSY` như `ACTIVE`. Trạng thái realtime vẫn hiện khi mở trạm (từ `detail.depotStatus`). |
| Chỗ lưu trạng thái | Thêm cột thứ 9 `status` vào hàng `base` (mã số 0 hoạt động / 1 bảo trì / 2 ngừng / 3 chưa khai trương), `base.v = 3`. Không thêm file mới. Client cũ đọc base mới vẫn chạy (bỏ qua cột thừa). |
| Trạm chưa khai trương | **Luôn hiện, ghim mờ** + nhãn "Sắp khai trương" trong chi tiết. Bảo trì / ngừng cũng mờ. |
| Ưu tiên trạng thái khi mở trạm | `detail.depotStatus` (live) đè trạng thái từ base; chưa có detail thì dùng base. |
| Mức lọc công suất | Một lựa chọn `power: 'all' \| 'dc' \| 'dc120'`. Hai chip loại trừ nhau, bấm lại thì tắt. Trạm chưa có dữ liệu power bị ẩn khi đang lọc. Lúc `power` còn đang tải mà bật chip thì vẫn lọc theo dữ liệu đã có (chưa có = ẩn). |
| Mốc "siêu nhanh" | **≥ 120 kW** (dữ liệu: 120 kW 2.275 trạm, 180/250/150 kW ~780 trạm). |
| Màu ghim theo mức | AC hoặc chưa rõ: `#12B76A` (giữ nguyên). DC < 120: `#0284C7`. DC ≥ 120: `#7C3AED`. Glyph vẫn là trụ sạc. Trạm đã lưu vẫn đeo ghim nhóm như cũ (nhóm thắng màu kW). |
| Làm mờ | `icon-opacity` 0.45 theo thuộc tính `st` của feature. Không cần thêm ảnh ghim. |
| Chip "Đang hoạt động" | Bật thì ẩn trạm có `status ≠ 0`. Mặc định tắt. |
| Gần tôi: vị trí | `userPos` từ GeolocateControl; chưa có thì dùng tâm bản đồ (MapView báo qua `onMoveEnd`), tiêu đề ghi "Gần tâm bản đồ". |
| Gần tôi: lọc | Áp bộ lọc công suất đang bật, luôn bỏ trạm `status ≠ 0`, lấy 20 trạm, quét tối đa ~100 km. |
| Sao lưu: định dạng | JSON `{ v: 1, kind: 'tramsac.groups', groups, members }` (giống `StoredBook` + `kind`). Link/QR: JSON → `deflate-raw` (`CompressionStream`) → base64url, đặt trong **hash** `#import=` (không bao giờ tới server / log). |
| Sao lưu: nhập | **Gộp** (union), không thay thế. Nhóm tự tạo trùng id thì gộp thành viên. Trạm đã có giữ `savedAt` cũ. Hỏi xác nhận trước ("Nhập N trạm, M nhóm"). |
| QR quá dài | Payload nén > 2.000 ký tự thì không vẽ QR, chỉ còn link + file. |
| Git | Người dùng tự commit WIP hiện tại trước. Mỗi phase một commit. |

## 3. Payload / DTO shape

```ts
// src/data/types.ts
/** Mã trạng thái trong base (cột 9). Builder gộp BUSY vào ACTIVE. */
export type StationStatus = 0 | 1 | 2 | 3 // 0 hoạt động, 1 bảo trì, 2 ngừng, 3 chưa khai trương

export interface Station {
  // ...các trường cũ
  status: StationStatus
}

// src/data/backup.ts
export interface GroupBackup {
  v: 1
  kind: 'tramsac.groups'
  groups: Array<Omit<StationGroup, 'builtIn'>> // chỉ nhóm tự tạo
  members: Record<string, Record<string, number>>
}
```

Base v3: `fields: ['id','storeId','name','address','lat','lng','flags','availableDate','status']`.

## 4. Phase breakdown

| Phase | File | Mục tiêu | Phụ thuộc |
|---|---|---|---|
| 01 | phase-01-status-data.md | Builder ghi cột `status` vào base v3; client đọc thành `Station.status`. | — |
| 02 | phase-02-status-ui.md | Ghim mờ theo trạng thái, nhãn trong chi tiết trạm, chip "Đang hoạt động". | 01 |
| 03 | phase-03-power-filter.md | Chip lọc DC / ≥ 120 kW, màu ghim theo mức kW, chú giải màu. | 02 |
| 04 | phase-04-nearby.md | Chip "Gần tôi" + bảng 20 trạm gần nhất áp bộ lọc. | 03 |
| 05 | phase-05-group-backup.md | Xuất / nhập nhóm qua link + QR + file JSON, gộp có xác nhận. | — |
| 06 | phase-06-docs.md | README, CHANGELOG, `changelog.ts` bản 0.6.0. | 01–05 |

Phase 02 → 03 → 04 nối tiếp nhau vì cùng sửa `Filters` trong `App.tsx` và `toGeoJSON` trong `MapView.tsx`. Phase 05 độc lập.

## 5. Phạm vi (In / Out)

**In scope:** `builder/lib/snapshot.mjs`, `builder/lib/build.mjs`, `src/data/{types,stations,groups,backup}.ts`, `src/data/useGroupBook.ts`, `src/map/{MapView,pins}.ts(x)`, `src/ui/{StationSheet,SavedSheet,NearbySheet,BackupSheet}.tsx`, `src/App.tsx`, docs.

**Out of scope:**
- Cron trạng thái theo giờ / trạng thái BUSY trên bản đồ (đã chốt: build ngày).
- Lọc 24/7 + gửi xe (mục 4 của danh sách, không chọn).
- Đổi path `/tram` → `/station` và tính năng trip (plan `261116-1710-trip-along-route`).
- Đồng bộ nhóm qua server / tài khoản.
- Thêm test runner (repo chưa có jest/vitest). Kiểm bằng `tsc`, build và chạy thử trên trình duyệt.

## 6. Risks

- **Plan trip đang chờ cũng sửa `App.tsx` / `MapView.tsx`.** Làm plan nào sau thì rebase tay. Chấp nhận được: hai plan chạm các khối khác nhau (Filters/toGeoJSON so với lớp tuyến/tripFocus).
- **`setData` 25k feature mỗi lần đổi lọc / power tải xong** (~vài chục ms). Hiện đã làm vậy khi đổi nhóm, nên chấp nhận được. Nếu giật thì chuyển lọc sang `setFilter` bằng biểu thức MapLibre (để sau).
- **Base mới (v3) trước khi client mới deploy:** client cũ bỏ qua cột 9, không vỡ. Client mới đọc base cũ (v2, thiếu cột 9) thì `status = 0` hết. Không vỡ, chỉ chưa có trạng thái.
- **`CompressionStream('deflate-raw')`:** có trên Chrome 103+, Safari 16.4+, Firefox 113+. Thiếu thì link dùng base64url của JSON không nén, tiền tố `j.` thay vì `z.`.
- **Nhập link của người khác ghi vào sổ nhóm:** chỉ gộp, không xoá gì, và luôn hỏi xác nhận trước. `parseBook` đã lọc icon/màu không hợp lệ.
- **Mapping `UNAVAILABLE`→Planned mới dựa trên 3 mẫu.** Phase 01 in thống kê theo trạng thái; phase 02 so thêm vài trạm khi chạy thử.
