# Phase 05 — Sao lưu / chuyển nhóm sang máy khác

**Goal:** Từ bảng "Trạm sạc đã lưu" mở được **Sao lưu / chuyển máy**: QR + link `…/#import=<payload>`, sao chép link, tải file `tramsac-nhom-<yyyymmdd>.json`, nhập từ file. Mở app bằng link `#import=` thì hỏi xác nhận rồi gộp vào sổ nhóm. Xong thì xoá hash.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/data/backup.ts` | CREATE: encode/decode payload, `mergeBooks` |
| `src/data/groups.ts` | MODIFY: export `StoredBook` + một hàm `bookFromStored(s)` tách từ `parseBook` để dùng lại phần làm sạch |
| `src/data/useGroupBook.ts` | MODIFY: action `merge(incoming)` |
| `src/ui/BackupSheet.tsx` | CREATE: QR + link + file |
| `src/ui/ImportDialog.tsx` | CREATE: xác nhận nhập (từ link hoặc file) |
| `src/ui/SavedSheet.tsx` | MODIFY: nút "Sao lưu / chuyển máy" ở header |
| `src/App.tsx` | MODIFY: đọc `location.hash` lúc khởi tạo, state `importing`, gắn hai bảng |

QR: dùng lại `drawQr` / `downloadBlob` trong `src/lib/qrCard.ts` (thư viện `qrcode` đã có). Không thêm dependency.

## 2. `src/data/backup.ts`

```ts
import { serializeBook, bookFromStored, type GroupBook, type StoredBook } from './groups'

export interface GroupBackup extends StoredBook {
  kind: 'tramsac.groups'
}

/** Payload dài hơn thì QR quá dày, điện thoại khó quét — chỉ còn link + file. */
export const QR_MAX = 2000

export function toBackup(book: GroupBook): GroupBackup {
  return { ...(JSON.parse(serializeBook(book)) as StoredBook), kind: 'tramsac.groups' }
}

/** "z.<base64url(deflate-raw)>"; trình duyệt không có CompressionStream thì "j.<base64url(json)>". */
export async function encodeBackup(b: GroupBackup): Promise<string>
export async function decodeBackup(s: string): Promise<GroupBook | null> // sai định dạng → null

/** Đọc file .json người dùng chọn. Thiếu `kind` mà có `groups`/`members` vẫn nhận (file sửa tay). */
export async function readBackupFile(file: File): Promise<GroupBook | null>

/**
 * Gộp `incoming` vào `book`: nhóm tự tạo chưa có thì thêm; thành viên chưa có thì thêm với
 * savedAt của file; trạm đã có giữ savedAt hiện tại. Không xoá gì.
 */
export function mergeBooks(book: GroupBook, incoming: GroupBook): GroupBook

/** Đếm để hiện câu xác nhận: số trạm mới, số nhóm mới. */
export function diffCount(book: GroupBook, incoming: GroupBook): { stations: number; groups: number }
```

Chi tiết `mergeBooks`: nhóm tự tạo trùng id nhưng khác tên thì **giữ tên / màu / ttl của máy hiện tại**. Thành viên nhập vào nhóm có `ttlHours > 0` mà `savedAt` của file đã hết hạn thì vẫn chép, rồi `alive()` tự ẩn. Hành vi giống hệt dữ liệu cũ.

## 3. `src/data/groups.ts`

Tách thân `parseBook` thành `bookFromStored(s: Partial<StoredBook>): GroupBook`. `parseBook(raw)` chỉ còn `JSON.parse` + gọi hàm này. `StoredBook` được export. Không đổi hành vi.

## 4. `src/App.tsx`

```tsx
// Đọc NGAY lúc khởi tạo, cùng chỗ với linkedId: effect URL bên dưới có thể đổi pathname.
const [importHash] = useState(() => /^#import=(.+)$/.exec(location.hash)?.[1] ?? null)
const [importing, setImporting] = useState<GroupBook | null>(null)
useEffect(() => {
  if (!importHash) return
  history.replaceState(null, '', location.pathname + location.search) // bỏ hash dù nhập hay huỷ
  decodeBackup(decodeURIComponent(importHash)).then((b) => b && setImporting(b))
}, [importHash])
```

Effect đồng bộ URL hiện có (`replaceState(path + location.search)`) đã tự bỏ hash. Effect import chạy trước để đọc hash, nhưng giá trị đã chụp bằng `useState` lúc khởi tạo nên thứ tự không quan trọng.

## 5. UI

- **BackupSheet** (ResponsiveDialog con của SavedSheet): mô tả "N trạm trong M nhóm. Mở link hoặc quét QR trên máy kia để gộp vào." Phía dưới là QR (nếu payload ≤ `QR_MAX`), nút **Sao chép link**, **Chia sẻ** (Web Share nếu có), **Tải file**, và **Nhập từ file…** (`<input type=file accept=".json,application/json">` ẩn).
- **ImportDialog**: "Nhập 12 trạm và 2 nhóm mới vào máy này? Trạm đã lưu sẵn giữ nguyên." Hai nút Huỷ / Gộp vào. Không có gì mới thì báo "Không có gì mới để nhập" + nút Đóng. Payload hỏng thì báo "Link sao lưu không đọc được".
- Link dùng `shareOrigin()` (local → domain thật, giống QR trạm).

## 6. Acceptance criteria

- [ ] `npm run build` pass.
- [ ] Máy A: lưu 5 trạm vào 2 nhóm (1 nhóm tự tạo), mở Sao lưu, sao chép link. Mở link trong cửa sổ ẩn danh (máy B rỗng), xác nhận thì thấy đủ 5 trạm, đúng nhóm, đúng màu / icon. Thanh địa chỉ không còn `#import`.
- [ ] Mở lại cùng link trên B: báo "Không có gì mới để nhập".
- [ ] B có sẵn 1 trạm khác: nhập xong thì có 6, trạm cũ còn nguyên.
- [ ] Tải file `.json` ở A, nhập file ở B ra cùng kết quả.
- [ ] Link bị cắt cụt / sửa bậy: báo lỗi, app không sập, sổ nhóm không đổi.
- [ ] 300 trạm: QR ẩn, link + file vẫn chạy.
- [ ] Huỷ ở ImportDialog: sổ nhóm không đổi, hash đã bị xoá.
- [ ] Regression: tạo / xoá nhóm, tự gỡ theo ttl, đồng bộ giữa hai tab vẫn chạy.

## 7. Out of scope

- Đồng bộ tự động qua server.
- Chế độ "thay thế toàn bộ" khi nhập.

## 8. Commit message dự kiến

```
feat(groups): sao lưu / chuyển nhóm đã lưu qua link, QR hoặc file

Payload là StoredBook nén deflate-raw + base64url đặt trong hash #import= nên
không tới server. Nhập luôn GỘP (mergeBooks), hỏi xác nhận kèm số trạm/nhóm mới.
Tách bookFromStored khỏi parseBook để dùng chung phần làm sạch dữ liệu.
```
