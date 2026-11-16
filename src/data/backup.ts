/**
 * Sao lưu / chuyển sổ nhóm sang máy khác. Ba đường: link `#import=<payload>` (cũng là nội dung
 * QR), file `.json`, và nhập lại từ file. Payload nằm trong HASH nên không bao giờ tới server
 * hay log. Nhập luôn GỘP vào sổ hiện có — không xoá gì của máy nhận.
 */
import { bookFromStored, serializeBook, type GroupBook, type StoredBook } from './groups'

export interface GroupBackup extends StoredBook {
  kind: 'tramsac.groups'
}

/** Payload dài hơn thì QR quá dày, điện thoại khó quét — chỉ còn link + file. */
export const QR_MAX = 2000

export const IMPORT_HASH = '#import='

export function toBackup(book: GroupBook): GroupBackup {
  return { ...(JSON.parse(serializeBook(book)) as StoredBook), kind: 'tramsac.groups' }
}

// ------------------------------------------------------------ mã hoá link

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}

const hasCompression = () => typeof CompressionStream === 'function'

/** `z.<base64url(deflate-raw)>`; trình duyệt không có CompressionStream thì `j.<base64url(json)>`. */
export async function encodeBackup(b: GroupBackup): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(b))
  if (!hasCompression()) return `j.${toBase64Url(json)}`
  return `z.${toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))}`
}

/** Payload hỏng / cụt / sai định dạng → null (không ném lỗi). */
export async function decodeBackup(s: string): Promise<GroupBook | null> {
  try {
    const [kind, data] = [s.slice(0, 2), s.slice(2)]
    let bytes = fromBase64Url(data)
    if (kind === 'z.') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'))
    else if (kind !== 'j.') return null
    return fromJson(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

export async function backupUrl(origin: string, book: GroupBook): Promise<string> {
  return `${origin}/${IMPORT_HASH}${await encodeBackup(toBackup(book))}`
}

// ------------------------------------------------------------ file

/** Đọc file .json người dùng chọn. Thiếu `kind` mà có `groups`/`members` vẫn nhận (file sửa tay). */
export async function readBackupFile(file: File): Promise<GroupBook | null> {
  // Sổ nhóm thật chỉ vài chục KB; chặn file to để không treo tab vì chọn nhầm.
  if (file.size > 2_000_000) return null
  try {
    return fromJson(await file.text())
  } catch {
    return null
  }
}

function fromJson(text: string): GroupBook | null {
  const o = JSON.parse(text) as Partial<GroupBackup> | null
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null
  if (o.kind !== undefined && o.kind !== 'tramsac.groups') return null
  if (!('groups' in o) && !('members' in o)) return null
  return bookFromStored(o)
}

// ------------------------------------------------------------ gộp

/**
 * Gộp `incoming` vào `book`: nhóm tự tạo chưa có thì thêm; thành viên chưa có thì thêm với
 * savedAt của file; trạm đã có giữ savedAt hiện tại. Nhóm trùng id giữ tên/màu/hạn của máy này.
 */
export function mergeBooks(book: GroupBook, incoming: GroupBook): GroupBook {
  const known = new Set(book.groups.map((g) => g.id))
  const added = incoming.groups.filter((g) => !g.builtIn && !known.has(g.id))
  const members: GroupBook['members'] = { ...book.members }
  for (const [gid, m] of Object.entries(incoming.members)) {
    members[gid] = { ...m, ...(book.members[gid] ?? {}) }
  }
  // bookFromStored lo thứ tự nhóm (dựng sẵn trước, rồi theo tên) như lúc đọc từ kho.
  return bookFromStored(JSON.parse(serializeBook({ groups: [...book.groups, ...added], members })) as StoredBook)
}

/** Đếm để hiện câu xác nhận: số trạm mới (chưa nằm trong nhóm đó), số nhóm mới. */
export function diffCount(book: GroupBook, incoming: GroupBook): { stations: number; groups: number } {
  const known = new Set(book.groups.map((g) => g.id))
  const groups = incoming.groups.filter((g) => !g.builtIn && !known.has(g.id)).length
  const ids = new Set<string>()
  for (const [gid, m] of Object.entries(incoming.members)) {
    for (const id of Object.keys(m)) if (!(id in (book.members[gid] ?? {}))) ids.add(id)
  }
  return { stations: ids.size, groups }
}
