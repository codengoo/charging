# Phase 04 — Ghi chú cá nhân

**Goal:** Ghi chú riêng cho từng trạm, lưu trên máy, đi kèm sao lưu / chuyển máy.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/data/notes.ts` | CREATE — `useNotes()`: `notes`, `set(id, text)` (rỗng = xoá), `merge(incoming)` |
| `src/ui/NoteBox.tsx` | CREATE — chưa có: nút "Thêm ghi chú"; có: hiện chữ, bấm để sửa (textarea, lưu khi bấm Xong / blur) |
| `src/ui/StationSheet.tsx` | MODIFY — gắn `NoteBox` dưới chip nhóm |
| `src/data/backup.ts` | MODIFY — payload thêm `notes?`; decode trả cả ghi chú |
| `src/ui/BackupSheet.tsx`, `src/ui/ImportDialog.tsx`, `src/App.tsx` | MODIFY — truyền / gộp ghi chú; hộp xác nhận ghi thêm số ghi chú |
| `src/ui/SavedSheet.tsx` | MODIFY — trạm đã lưu có ghi chú thì hiện 1 dòng ghi chú |

## 2. Acceptance criteria

- [ ] `npm run build` qua.
- [ ] Playwright: viết ghi chú → reload còn; tạo link sao lưu → mở ở context mới → nhập → ghi chú có.
- [ ] Payload sao lưu cũ (không có `notes`) vẫn nhập được.

## 3. Commit message dự kiến

```
feat: ghi chú cá nhân cho từng trạm, lưu trên máy và đi kèm sao lưu
```
