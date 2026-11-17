# Drawer nâng lên khi cuộn, thu về khi cuộn lại tới top

**Date:** 2026-11-17 14:55 (ICT)
**Scope:** `src/lib/`, `src/components/ui/responsive-dialog.tsx`, `src/ui/TripPanel.tsx`
**Trigger:** Drawer dài trên điện thoại mở ngay 92% màn hình (ResponsiveDialog) hoặc 60% (Dọc đường), người dùng cuộn trong khung nhỏ. Muốn: ban đầu thấp, cuộn xuống thì drawer nâng lên gần full, cuộn ngược lên chạm top thì về vị trí ban đầu.

## 1. Goal

Mọi drawer điện thoại (ResponsiveDialog: trạm, gần bạn, đã lưu, cài đặt, xe, nhóm, sao lưu, chia sẻ, changelog…) và bảng Dọc đường: chiều cao tối đa ban đầu 60dvh; cuộn nội dung xuống → max-height chuyển sang `100dvh − safe-area-inset-top − 8px` (sát dưới status bar), có transition; cuộn ngược tới top → về 60dvh. Màn rộng (hộp thoại, thẻ Dọc đường bên trái) giữ nguyên.

## 2. Quyết định đã chốt (Q&A 1 vòng)

| Câu hỏi | Lựa chọn |
|---|---|
| Phạm vi | Tất cả drawer điện thoại (sửa ở ResponsiveDialogContent) + bảng Dọc đường. Màn rộng không đổi. |
| Ban đầu | Tối đa 60dvh (nội dung ngắn thì cao vừa nội dung). |
| Khi nâng | `calc(100dvh - env(safe-area-inset-top) - 8px)` — che cả ô tìm kiếm. |
| Ngưỡng nâng | scrollTop > 8px. |
| Ngưỡng thu | Người dùng cuộn ngược tới scrollTop ≤ 0 khi nội dung vẫn cuộn được; hoặc nội dung không cuộn được nữa (vừa khít sau khi nâng) thì kéo xuống ≥ 24px tại top (touch) / lăn chuột lên. KHÔNG thu khi scrollTop về 0 do bị kẹp (clamp) lúc nâng — tránh nâng/thu liên tục. |
| Hiệu ứng | `transition: max-height 300ms ease-out`. |

## 3. State machine

```
compact ──scrollTop > 8──▶ expanded
expanded ──(cuộn lên, scrollTop ≤ 0, scrollHeight > clientHeight)──▶ compact
expanded ──(không cuộn được + kéo xuống ≥ 24px / wheel lên tại top)──▶ compact
mở lại drawer ──▶ compact (state nằm trong content, gỡ khi đóng)
```

## 6. Phase breakdown

| Phase | File | Mục tiêu | Phụ thuộc |
|---|---|---|---|
| 01 | phase-01-expand-on-scroll.md | Hook `useExpandOnScroll` + áp vào ResponsiveDialogContent và TripPanel | — |

## 8. Phạm vi

**In:** `src/lib/useExpandOnScroll.ts` (mới), `src/components/ui/responsive-dialog.tsx`, `src/ui/TripPanel.tsx`.
**Out:** snap points của vaul, kéo tay cầm để nâng/thu (tay cầm vẫn là kéo để đóng như cũ), màn rộng.

## 9. Risks

- vaul tự đặt style khi bàn phím mở (repositionInputs) → có thể đè max-height lúc gõ; chấp nhận, kiểm bằng ô tìm kiếm trong Cài đặt nếu thấy lỗi.
- Nội dung đổi chiều cao khi đang nâng (tải xong live/đánh giá) → không tự thu; chấp nhận.
