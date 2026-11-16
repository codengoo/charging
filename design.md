# Design — Bản đồ trạm sạc (web)

Hệ thiết kế dùng chung với **chiatien** (`D:\amis\chiatien`): shadcn trên Tailwind v4, nền iOS
neutral, bo góc mềm, chuyển động nhẹ. Tài liệu này ghi **quy ước đã chốt** để mọi màn hình mới
trông như cùng một app. Khi nghi ngờ: mở component tương ứng bên chiatien và làm giống.

> Nguồn thật là code: token ở `src/index.css`, component ở `src/components/ui/`. Sửa token/
> component thì sửa cả file này.

---

## 1. Nguyên tắc

1. **Bản đồ là nhân vật chính.** Mọi thứ nổi trên bản đồ đều nhỏ, có nền kính mờ + bóng nhẹ,
   không che quá 1/3 màn hình khi chưa mở bảng.
2. **Một việc — một bảng.** Chi tiết trạm, lưu nhóm, chia sẻ là các bảng riêng xếp chồng
   (drawer trên mobile, dialog trên desktop), không nhồi nhiều việc vào một bảng.
3. **Giống chiatien trước, sáng tạo sau.** Pattern nào chiatien đã có (chia sẻ/QR, segmented,
   copy link, tải ảnh) thì lấy nguyên bố cục, chỉ đổi màu brand và nội dung.
4. **Tiếng Việt, ngắn, nói việc người dùng làm được.** "Sao chép", "Tải ảnh QR", "Chia sẻ…".

## 2. Màu

| Token | Sáng | Tối | Dùng cho |
|---|---|---|---|
| `--background` | `#f5f5f7` | `#000` | nền trang |
| `--card` / `--popover` | `#fff` | `#1c1c1e` | bảng, dialog, chip nổi |
| `--foreground` | `#1c1c1e` | `#f5f5f7` | chữ chính |
| `--muted` / `--secondary` | `#f0f0f2` | `#2c2c2e` | rãnh segmented, ô input, chip phụ |
| `--muted-foreground` | `#8e8e93` | `#98989f` | mô tả, chú thích |
| `--primary` | `#1c1c1e` | `#f5f5f7` | nút hành động chính trung tính (vd. "Sao chép") |
| `--brand` | emerald `oklch(0.596 0.145 163)` | `oklch(0.696 0.17 162)` | CTA chính ("Chỉ đường"), chip đang bật |
| `--destructive` | đỏ | đỏ sáng | xoá |

**Khác chiatien duy nhất:** chiatien `--brand` vàng `#fcc93a` (đổi theo theme nhóm); tramsac
brand **xanh emerald cố định** (màu trạm sạc). Ảnh QR tải về dùng `#009966`.

**Màu nghiệp vụ** (không phải token theme, định nghĩa trong code):
- Ghim trạm thường `#12B76A`, trạm đang chọn `#0B6B3A`, cụm marker `#0b7a47`.
- 3 nhóm dựng sẵn: Yêu thích `#E53935`, Sao `#F0A500`, Sẽ đến `#2563EB`.
- 8 màu pastel nhóm tự tạo — `COLORS` trong `src/data/groups.ts`.
- Trên nền màu nhóm: đĩa = `tintHex(color, .24)` (trộn trắng), hình = `darkenHex(color, .62)`
  (`src/map/pins.ts`). Không dùng alpha trên bản đồ — nền là ảnh, alpha ăn theo đường sá.

## 3. Chữ

| Vai trò | Font | Cỡ / độ đậm |
|---|---|---|
| Tiêu đề bảng/dialog | **Bricolage Grotesque** (`font-heading`) | `text-base sm:text-lg`, `font-semibold`–`font-bold` |
| Nội dung | **Be Vietnam Pro** (`font-sans`) | `text-sm` (14), `text-[15px]` cho dòng danh sách |
| Mô tả dưới tiêu đề | Be Vietnam Pro | `text-xs sm:text-sm text-muted-foreground` |
| Chú thích phụ | Be Vietnam Pro | `text-xs` / `text-[11px]` |

- `DialogTitle` và `DrawerTitle` đã có sẵn `font-heading font-semibold leading-tight` — không
  cần thêm, chỉ chỉnh cỡ.
- Không viết hoa toàn bộ. Sentence case cho mọi nhãn.

## 4. Kích thước, bo góc, khoảng cách

- `--radius: 0.875rem`. Thang: `rounded-lg` (nút), `rounded-xl` (input, rãnh segmented, khối
  muted), `rounded-2xl` (dialog, ô QR), `rounded-t-[1.75rem]` (drawer), `rounded-full` (chip).
- Nhịp dọc trong bảng: **`gap-3` mobile / `sm:gap-4` desktop**.
- Gutter: `p-5` dialog, `px-5` drawer, `p-3` cho cụm nổi trên bản đồ.
- Vùng chạm tối thiểu 32px (`h-8`); nút chính 40px (`h-10`).

## 5. Component (`src/components/ui/`)

| Component | Khi nào dùng | Ghi chú |
|---|---|---|
| `Button` | mọi hành động | `brand` = CTA chính của bảng (tối đa 1); `default` (đen) = hành động chính trung tính đứng cạnh input; `outline` = hành động phụ chia đôi hàng; `ghost` = icon, "quay lại"; `destructive` = xoá. Cỡ: `default` h-10, `sm` h-8, `icon-sm` 28px |
| `Chip` | nhãn tĩnh + bộ lọc bật/tắt | `sm` h-7, `md` h-8. `selected` → brand. `floating` cho chip nổi trên bản đồ. **Không** dùng Badge cho nhãn mới |
| `Segmented` | chuyển chế độ loại trừ nhau trong một bảng (2–4 lựa chọn) | Rãnh `bg-muted p-1`, mục chọn nền trắng + bóng. Bộ lọc độc lập thì dùng Chip |
| `Input` | nhập liệu, hiện link chỉ đọc | `h-10 rounded-xl bg-muted`, focus viền brand |
| `ResponsiveDialog` | mọi bảng | Drawer < 640px, Dialog ≥ 640px. Bảng con mở từ bảng khác: `nested` + render **bên trong** cây bảng cha |
| `Badge` | chỉ còn cho nhãn phiên bản ở "Có gì mới" | |

Icon: **lucide-react**, `size-4` trong nút, `size-3.5` trong chip `sm`. Hình trong ghim bản đồ là
đường vẽ Material Icons (port từ app Android) — xem §7.

## 6. Pattern bảng (dialog / drawer)

```
Header (text-left, pr-6 chừa nút ×)
  Tiêu đề        font-heading, text-base sm:text-lg
  Mô tả 1–2 câu  text-xs sm:text-sm muted
Thân (flex-col gap-3 sm:gap-4)
Hàng hành động   2 nút outline chia đôi  — hoặc —  Footer: [phụ outline] [CTA brand]
```

- **Bảng luôn gắn sẵn, chỉ đổi `open`** — KHÔNG render kiểu `{show && <Sheet open />}`. Gỡ
  component lúc đóng thì vaul/Radix không kịp chạy hiệu ứng trôi xuống / mờ dần. Bảng hiện dữ
  liệu (vd. trạm) thì giữ bản cuối cùng để còn nội dung trong lúc đóng.
- Variant `data-open:` / `data-closed:` phải khớp `data-state` của Radix — đã định nghĩa trong
  `src/index.css` (chiatien lấy từ `shadcn/tailwind.css`). Thiếu là mất hết hiệu ứng mở/đóng.
- Desktop dialog có `max-h-[calc(100dvh-2rem)]` + cuộn trong; drawer mobile tự cuộn.
- Bảng chỉ đọc dài (changelog): không footer.
- Xoá: bấm 2 lần (nút đổi thành "Xoá?"), không mở hộp xác nhận riêng.

### Chia sẻ / QR — theo hộp "Invite friends" của chiatien

```
Chia sẻ trạm
Quét mã hoặc gửi link…                         (mô tả đổi theo chế độ)
[ 🔗 Link trạm | 📍 Google Maps ]              Segmented
        ┌──────────────┐
        │   QR trơn    │                        ô trắng rounded-2xl p-3 sm:p-4
        └──────────────┘                        ring-1 ring-foreground/10 shadow-sm
[ https://…………………… ] [⧉ Sao chép]              Input + Button default (→ "Đã chép")
[ ⤓ Tải ảnh QR ] [ ⇪ Chia sẻ… ]                 2 Button outline h-10, chia đôi
```

- QR hiển thị **168px mobile / 208px desktop**, vẽ ở 480px cho nét. Nền ô QR **luôn trắng**,
  kể cả chế độ tối (camera quét dễ). Không logo giữa mã trên màn hình.
- **Ảnh thẻ** (tiêu đề màu brand + mã + chú thích) chỉ dựng lúc tải về/chia sẻ file
  (`renderQrCard` trong `src/lib/qrCard.ts`, giống `src/lib/qr-image.ts` của chiatien).
- "Chia sẻ…": có Web Share → gửi kèm ảnh QR; không có (desktop) → chép "tên — địa chỉ + link"
  và báo "Đã chép lời nhắn".

## 7. Bản đồ

- Nền **OpenFreeMap Positron** (xám nhạt, ít POI) để ghim nổi.
- **Ghim** (`src/map/pins.ts`): khung 112×118, 3 lớp — vỏ giọt nước trắng viền `#D9DDE1` +
  bóng, đĩa màu nhạt, hình màu đậm. Rộng 34px (đang chọn 44px). Có lề đáy cho viền/bóng mũi
  ghim, bù bằng `icon-offset` để mũi cắm đúng toạ độ.
  - Thường: trụ sạc trên xanh. Đã lưu: hình + màu của nhóm đại diện. Đang chọn: tia sét.
- `PinPreview` dùng lại đúng ảnh ghim làm hình minh hoạ trong UI (bảng nhóm, danh sách đã lưu,
  form tạo nhóm) — nhìn là biết trạm hiện thế nào trên bản đồ.
- Cụm nổi trên bản đồ (tìm kiếm, chip lọc, nút phiên bản): `Chip variant="floating"` /
  `bg-card/90 backdrop-blur shadow-md shadow-black/10`.

## 8. Chuyển động

- Một đường cong cho mọi thứ: `--ease-out-soft: cubic-bezier(0.22,1,0.36,1)`.
- Mở bảng: nội dung hiện lần lượt (`sheet-stagger`, 60→300ms). Nút nhấn `active:scale-[0.97]`.
- Tôn trọng `prefers-reduced-motion` (đã tắt toàn cục trong `index.css`).

## 9. Truy cập

- Nút chỉ có icon phải có `aria-label` tiếng Việt mô tả hành động ("Chia sẻ trạm, mã QR").
- Chip bật/tắt có `aria-pressed`; Segmented dùng Radix ToggleGroup (radio).
- Canvas QR: `role="img"` + `aria-label`.
- Tương phản: chữ trên nền pastel dùng `groupOnColor`/`darkenHex`, không chữ trắng trên pastel.

## 10. Checklist trước khi merge UI

- [ ] Có pattern tương ứng bên chiatien chưa? Có thì bố cục giống.
- [ ] Tiêu đề `font-heading`, mô tả `text-xs sm:text-sm muted`, nhịp `gap-3 sm:gap-4`.
- [ ] Tối đa một nút `brand` mỗi bảng.
- [ ] Chụp thử mobile 390px (drawer) và desktop (dialog); chế độ tối không vỡ.
- [ ] Nhãn tiếng Việt, sentence case; icon-only có `aria-label`.
