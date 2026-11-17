/**
 * Sao lưu / chuyển sổ nhóm sang máy khác. Ba đường: link `#import=<payload>` (cũng là nội dung
 * QR), file `.json`, và nhập lại từ file. Payload nằm trong HASH nên không bao giờ tới server
 * hay log. Nhập luôn GỘP vào sổ hiện có — không xoá gì của máy nhận. Ghi chú cá nhân (notes.ts)
 * đi kèm trong trường `notes`, địa điểm hay dùng (places.ts) trong `places` (bản sao lưu cũ không có —
 * vẫn nhập được).
 */
import { bookFromStored, toStored, type GroupBook, type StoredBook } from './groups'
import { newNotesCount, parseNotes, type NoteMap } from './notes'
import { newPlacesCount, parsePlaces, type Place } from './places'
import { fromBase64Url, toBase64Url } from '../lib/text'

export interface GroupBackup extends StoredBook {
  kind: 'tramsac.groups'
  notes?: NoteMap
  places?: Place[]
}

/** Bản sao lưu đã đọc: sổ nhóm + ghi chú + địa điểm. */
export interface Backup {
  book: GroupBook
  notes: NoteMap
  places: Place[]
}

/** Payload dài hơn thì QR quá dày, điện thoại khó quét — chỉ còn link + file. */
export const QR_MAX = 2000

export const IMPORT_HASH = '#import='

export function toBackup(book: GroupBook, notes: NoteMap, places: Place[] = []): GroupBackup {
  const b: GroupBackup = { ...toStored(book), kind: 'tramsac.groups' }
  if (Object.keys(notes).length) b.notes = notes
  if (places.length) b.places = places
  return b
}

// ------------------------------------------------------------ mã hoá link

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
export async function decodeBackup(s: string): Promise<Backup | null> {
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

export async function backupUrl(origin: string, book: GroupBook, notes: NoteMap, places: Place[] = []): Promise<string> {
  return `${origin}/${IMPORT_HASH}${await encodeBackup(toBackup(book, notes, places))}`
}

// ------------------------------------------------------------ file

/** Đọc file .json người dùng chọn. Thiếu `kind` mà có `groups`/`members` vẫn nhận (file sửa tay). */
export async function readBackupFile(file: File): Promise<Backup | null> {
  // Sổ nhóm thật chỉ vài chục KB; chặn file to để không treo tab vì chọn nhầm.
  if (file.size > 2_000_000) return null
  try {
    return fromJson(await file.text())
  } catch {
    return null
  }
}

function fromJson(text: string): Backup | null {
  const o = JSON.parse(text) as Partial<GroupBackup> | null
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null
  if (o.kind !== undefined && o.kind !== 'tramsac.groups') return null
  if (!['groups', 'members', 'notes', 'places'].some((k) => k in o)) return null
  return { book: bookFromStored(o), notes: parseNotes(o.notes), places: parsePlaces(o.places) }
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
  return bookFromStored(toStored({ groups: [...book.groups, ...added], members }))
}

/** Đếm để hiện câu xác nhận: số trạm mới (chưa nằm trong nhóm đó), số nhóm mới, số ghi chú / địa điểm mới hoặc mới hơn. */
export function diffCount(
  book: GroupBook,
  notes: NoteMap,
  backup: Backup,
  places: Place[] = [],
): { stations: number; groups: number; notes: number; places: number } {
  const incoming = backup.book
  const known = new Set(book.groups.map((g) => g.id))
  const groups = incoming.groups.filter((g) => !g.builtIn && !known.has(g.id)).length
  const ids = new Set<string>()
  for (const [gid, m] of Object.entries(incoming.members)) {
    for (const id of Object.keys(m)) if (!(id in (book.members[gid] ?? {}))) ids.add(id)
  }
  return { stations: ids.size, groups, notes: newNotesCount(notes, backup.notes), places: newPlacesCount(places, backup.places) }
}
