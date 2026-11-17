# Chọn tuyến khác & đọc đủ link Google Maps (điểm kéo tuyến, tuỳ chọn tránh)

**Date:** 2026-11-17 12:53 (ICT)
**Scope:** `src/lib/mapsLink.ts`, `src/data/trip.ts`, `src/data/useTrip.ts`, `worker/api.ts`, `src/ui/TripPanel.tsx`, `src/map/MapView.tsx`, `src/App.tsx`, docs (`src/data/changelog.ts`, `CHANGELOG.md`, `README.md`)
**Trigger:** Google Maps gợi ý nhiều tuyến, nhưng link chia sẻ chỉ có các chặng nên app chỉ vẽ một tuyến do HERE chọn, có thể khác tuyến người dùng định đi. Cần (1) cho người dùng xem và chọn trong vài tuyến của HERE, (2) đọc thêm những gì link có ghi (điểm kéo tuyến, tuỳ chọn tránh) để tuyến HERE sát với Google hơn.

## 1. Goal

- Hành trình 2 điểm (không có điểm dừng / điểm kéo): HERE trả tối đa **3 tuyến**. Bảng Dọc đường có thẻ cho từng tuyến "121 km · 1 giờ 57 phút · 34 trạm"; bản đồ vẽ tuyến phụ màu xám, chạm vào đường xám hoặc thẻ đều chọn được tuyến đó. Danh sách trạm, % pin và kế hoạch sạc tính theo tuyến đang chọn.
- Link có **điểm kéo tuyến** (kéo tuyến trên Google bản máy tính): dùng làm điểm đi qua (`passThrough`) của HERE, nên tuyến gần như trùng Google. Sửa lỗi hiện tại: điểm kéo bị gán nhầm làm toạ độ chặng có tên.
- Link có **tuỳ chọn tránh** (thu phí / cao tốc / phà): chuyển sang `avoid[features]` của HERE. Trong bảng có 3 chip "Tránh" để bật/tắt, đổi là tính lại tuyến.
- Link có số thứ tự tuyến Google (`!5iN`, N > 0): hiện gợi ý "Trên Google bạn chọn tuyến thứ N+1 — chạm tuyến khớp bên dưới". Không tự chọn vì thứ tự tuyến của HERE khác Google.
- URL `/trip?link=…` giữ nguyên như hiện tại: **không** ghi tuyến đã chọn hay tuỳ chọn tránh.

## 2. Quyết định đã chốt (Q&A 1 vòng + kiểm link thật)

| Câu hỏi | Lựa chọn |
|---|---|
| Lưu tuyến đã chọn | **Không lưu** vào URL khi chia sẻ. Mở lại link → tuyến mặc định (tuyến 1 của HERE). |
| Giờ khởi hành gửi HERE | Mặc định của HERE (giao thông hiện tại) — không cần ổn định thứ tự vì không lưu tuyến. |
| Tuỳ chọn tránh | Đọc từ link làm giá trị đầu + 3 chip "Thu phí / Cao tốc / Phà" trong hộp cấu hình. Đổi chip → tính lại tuyến (không đọc lại link). Không ghi vào URL. |
| Chọn tuyến ở đâu | Thẻ trong bảng **và** chạm đường xám trên bản đồ. |
| Khi nào xin tuyến khác | Chỉ khi hành trình đúng 2 điểm và không có điểm kéo. Có điểm dừng / điểm kéo = người dùng đã chốt hướng, chỉ xin 1 tuyến (và tránh trường hợp HERE không hỗ trợ `alternatives` kèm `via` — chưa kiểm được vì thiếu key local). |
| Số tuyến | `alternatives=2` → tối đa 3. |
| Điểm kéo gửi HERE | `via=lat,lng!passThrough=true` — đi qua chứ không tạo chặng dừng. Client gửi token `lat,lng!p` trong `stops=`. |
| Số trạm trên thẻ | `alongRoute(...).total` cho từng tuyến, cùng bán kính + bộ lọc công suất đang dùng. |
| Khung nhìn bản đồ | Gộp bounds của mọi tuyến, nên chọn tuyến khác không làm bản đồ nhảy. |
| Gợi ý `!5iN` | Chỉ hiện chữ, không tự chọn. |
| Cách đọc `data=` | Dựng cây theo số đếm của token `!Nm<k>` (k = số token con cháu), rồi đọc theo field — không regex rời rạc. Định dạng xác minh bằng link thật (§7). |
| Phiên bản | 0.11.0. Mỗi phase một commit. Không deploy (người dùng tự `npm run deploy`). |

## 3. State machine (useTrip)

```
closed ──show()──▶ idle
any ──open(link)──▶ resolving ──▶ routing ──▶ ready
                        │            │
                        └────────────┴──▶ error (giữ stops đã có)
ready|error ──setAvoid(a)──▶ routing ──▶ ready | error      (giữ stops + vias, không đọc lại link)
ready ──selectRoute(i)──▶ ready                             (đồng bộ, không gọi mạng)
any ──close()──▶ closed
```
Lượt mới (`open` hoặc `setAvoid`) **huỷ** lượt đang chạy (AbortController dùng chung `job`), chỉ kết quả lượt mới nhất được ghi. `selectRoute` ngoài khoảng `routes` thì bỏ qua. `setAvoid` khi chưa có `stops` (đang resolving / idle) chỉ ghi `avoid`, không gọi mạng; lượt `open` đang chạy sẽ dùng `avoid` từ link.

## 5. Payload / DTO

```ts
// src/lib/mapsLink.ts
export interface Avoid {
  toll: boolean
  highway: boolean
  ferry: boolean
}
export interface ParsedLink {
  stops: TripStop[]
  /** vias[i] = các điểm kéo tuyến nằm giữa stops[i] và stops[i+1]. Dài bằng stops.length (phần tử cuối luôn rỗng). */
  vias: GeoPoint[][]
  avoid: Avoid
  /** Số thứ tự tuyến đang chọn trên Google (`!5iN`, đếm từ 0); null nếu link không ghi. */
  googleRoute: number | null
}

// src/data/useTrip.ts — TripState thêm
routes: RoutePath[]        // mọi tuyến HERE trả, tuyến 0 là mặc định
routeIdx: number           // đang chọn; `route` = routes[routeIdx] (giữ field cũ để App/TripPanel không đổi)
vias: GeoPoint[][]
avoid: Avoid
googleRoute: number | null

// GET /api/route
// stops=lat,lng;lat,lng!p;lat,lng   (2..22 token; `!p` = điểm đi qua, chỉ ở giữa)
// alt=0..2                           (mặc định 0; worker bỏ qua khi có token giữa)
// avoid=toll,highway,ferry           (tập con, phân tách bằng dấu phẩy)
```

## 6. Phase breakdown

| Phase | File | Mục tiêu | Phụ thuộc |
|---|---|---|---|
| 01 | phase-01-link-parser.md | Đọc `data=` thành cây: chặng, điểm kéo, tránh, `!5iN`; sửa lỗi gán nhầm toạ độ | — |
| 02 | phase-02-routes-data.md | Worker nhận `alt`/`avoid`/`!p`; client lấy nhiều tuyến; useTrip có `routes`, `selectRoute`, `setAvoid` | 01 |
| 03 | phase-03-route-ui.md | Thẻ tuyến + chip Tránh + gợi ý Google trong TripPanel; tuyến phụ xám chạm được trên bản đồ | 02 |
| 04 | phase-04-docs.md | Changelog 0.11.0, CHANGELOG.md, README | 03 |

## 7. Dữ liệu thật đã kiểm (2026-11-17, Chrome headless qua Playwright, `hl=vi`)

| Thao tác trên Google | `data=` (rút gọn) | Ý nghĩa |
|---|---|---|
| Chọn ô tô | `!4m2!4m1!3e0` | `3e0` = lái xe |
| Tránh thu phí | `!4m4!4m3!2m1!2b1!3e0` | `2m…!2b1` = tránh thu phí |
| Tránh thu phí + cao tốc | `!4m5!4m4!2m2!1b1!2b1!3e0` | `1b1` = tránh cao tốc |
| Chọn tuyến thứ 2 | `!4m3!4m2!3e0!5i1` | `5i1` = tuyến số 1 (đếm từ 0). Link rút gọn `maps.app.goo.gl/9QzYC2M8roAvoYK49` **giữ** `!5i1` |
| Kéo tuyến, 2 chặng là toạ độ | `!4m9!4m8!1m5!3m4!1m2!1d106.2167991!2d20.5370365!3s0x…!1m0!3e0` | chặng 1 có `3m` chứa điểm kéo; chặng 2 rỗng `1m0`. Link rút gọn `maps.app.goo.gl/eCKGGDb2HgB9VTtJ8` giữ nguyên |
| Kéo tuyến, 2 chặng có tên | `!4m19!4m18!1m10!1m1!1s0x…!2m2!1d105.8521484!2d21.0286669!3m4!1m2!1d106.2053022!2d20.8498361!3s0x…!1m5!1m1!1s0x…!2m2!1d106.6818164!2d20.8572691!3e0` | toạ độ chặng ở `2m2`, điểm kéo ở `3m4!1m2`. **Parser hiện tại lấy 3 cặp `!1d!2d` và gán điểm kéo (106.205, 20.850) cho Hải Phòng.** Link rút gọn `maps.app.goo.gl/tqydyjuPDkuehMoz6` |

Chưa kiểm được: cờ tránh **phà** (đoán là `3b1`, Playwright không tìm thấy ô "Phà"), 2 điểm kéo trên cùng một chặng (lần kéo thứ hai chỉ dời điểm cũ), link chia sẻ từ app Android có điểm kéo (app điện thoại không cho kéo tuyến). Có `HERE_API_KEY` local đang trống nên chưa gọi thử `alternatives` / `avoid` của HERE.

### Phát sinh trong lúc làm (commit riêng, giữa phase 02 và 03)

Người dùng báo `https://maps.app.goo.gl/euKgJxms8gdcQKee6?g_st=ic` (chia sẻ từ app iOS) không đọc được. Link chuyển tới `https://maps.google.com/?saddr=21.0075870,105.8008470&daddr=Thanh+Vân,…&geocode=<b64>;<b64>&dirflg=d`:
- Worker chỉ nhận `google.<tld>/maps…` → thêm `maps.google.<tld>/…`. Siết luôn host thành `GOOGLE_HOST` (đuôi `.com` / `.vn` / `.com.vn`…) vì `[a-z.]+` cũ cho lọt `google.evil.com`, ở cả kiểm đích lẫn vòng đi theo redirect.
- `mapsLink.ts` thêm `readLegacy`: `saddr` + `daddr` (nhiều điểm nối bằng ` to:`), toạ độ lấy từ `geocode` (mỗi chặng một protobuf base64: field 2 = vĩ độ × 1e6, field 3 = kinh độ × 1e6), `dirflg` `h`/`t` → tránh cao tốc / thu phí (chưa thấy trong link thật).

## 8. Phạm vi (In / Out)

**In scope:** các file ở **Scope**.

**Out of scope:**
- Ghi tuyến / tuỳ chọn tránh vào URL (đã chốt không lưu).
- Kéo tuyến hay thêm điểm ngay trên bản đồ của app (cách 3 trong bàn luận).
- Đoán tuyến HERE nào khớp với `!5iN` của Google.
- Xin tuyến khác cho hành trình có điểm dừng.
- Thêm framework test (repo không có; kiểm bằng script esbuild trong scratchpad như các plan trước).

## 9. Risks

- **Google đổi định dạng `data=`** → parser trả về như cũ (không vias, không tránh), không ném lỗi; chặng có tên vẫn đọc theo thứ tự `2m` hoặc `!3d!4d`. Chấp nhận được.
- **HERE từ chối `alternatives` hoặc `avoid`** (chưa kiểm vì thiếu key) → nếu `alt>0` lỗi thì client gọi lại một lần với `alt=0`. Cần người dùng điền `HERE_API_KEY` vào `.dev.vars` hoặc kiểm sau deploy.
- **Tốn lượt HERE:** `alternatives` vẫn tính 1 request; đổi chip Tránh mỗi lần tốn 1 request — cùng rate limit `API_LIMIT`. Chấp nhận được.
- **`alongRoute` chạy 3 lần** (mỗi tuyến một lần để đếm trạm) → vài ms mỗi lần với ≤ 1.500 điểm. Chấp nhận được.
- **`TripPanel.tsx` đang có thay đổi chưa commit của người dùng** (hộp cấu hình nền xám, chip `variant="outline"`). Phase 03 sửa chồng lên đó; commit phase 03 sẽ kéo theo phần này — báo rõ trong tin nhắn cuối. `VehicleSheet.tsx`, `src/components/ui/select.tsx`, `responsive-select.tsx` không đụng, không commit.
- **Chạm tuyến xám trên điện thoại khó trúng** → lớp bắt chạm trong suốt rộng 24 px.
