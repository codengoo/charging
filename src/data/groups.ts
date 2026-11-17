/**
 * Nhóm trạm người dùng tự xếp. Port từ StationGroup.kt / GroupBook (charge-map-android).
 *
 * Một trạm nằm được nhiều nhóm cùng lúc. Ba nhóm dựng sẵn có id cố định, nhóm tự tạo
 * lấy id sinh từ đồng hồ — đổi tên hiển thị sau này không làm mất dữ liệu cũ.
 */

import { pick } from '../i18n'
import { readJson, readStr, removeKey, writeStr } from '../lib/storage'

/** Mã hình — tầng dữ liệu không phụ thuộc React, UI tự tra mã ra icon. */
export type GroupIconKey =
  | 'heart'
  | 'star'
  | 'flag'
  | 'bookmark'
  | 'bolt'
  | 'place'
  | 'home'
  | 'work'
  | 'cart'
  | 'coffee'
  | 'bed'

export interface StationGroup {
  id: string
  label: string
  builtIn: boolean
  iconKey: GroupIconKey
  colorHex: string
  /**
   * Bao lâu sau khi lưu thì trạm tự rời nhóm. 0 = không bao giờ.
   * Chỉ nhóm TỰ TẠO mới đặt được; ba nhóm dựng sẵn giữ vĩnh viễn.
   */
  ttlHours: number
}

const L = pick({
  vi: {
    favorite: 'Yêu thích',
    star: 'Sao',
    planned: 'Đánh dấu sẽ đến',
    ttl: ['Không tự gỡ', '6 giờ', '1 ngày', '3 ngày', '1 tuần', '30 ngày'],
    underMinute: 'dưới 1 phút',
    days: (n: number) => `${n} ngày`,
    hours: (n: number) => `${n} giờ`,
    minutes: (n: number) => `${n} phút`,
  },
  en: {
    favorite: 'Favorites',
    star: 'Starred',
    planned: 'Planned',
    ttl: ['Never', '6 hours', '1 day', '3 days', '1 week', '30 days'],
    underMinute: 'under 1 minute',
    days: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    hours: (n: number) => `${n} ${n === 1 ? 'hour' : 'hours'}`,
    minutes: (n: number) => `${n} ${n === 1 ? 'minute' : 'minutes'}`,
  },
})

export const FAVORITE = 'favorite'
export const STAR = 'star'
export const PLANNED = 'planned'

export const BUILT_IN: StationGroup[] = [
  { id: FAVORITE, label: L.favorite, builtIn: true, iconKey: 'heart', colorHex: '#E53935', ttlHours: 0 },
  { id: STAR, label: L.star, builtIn: true, iconKey: 'star', colorHex: '#F0A500', ttlHours: 0 },
  { id: PLANNED, label: L.planned, builtIn: true, iconKey: 'flag', colorHex: '#2563EB', ttlHours: 0 },
]

/**
 * Mã hình cho nhóm TỰ TẠO. Không có heart / star / flag: đó là dấu riêng của ba nhóm
 * dựng sẵn, cho chọn lại thì trên bản đồ không còn phân biệt được.
 */
export const ICON_KEYS: GroupIconKey[] = [
  'bookmark', 'bolt', 'place', 'home', 'work', 'cart', 'coffee', 'bed',
]

/** Bảng màu pastel cho nhóm tự tạo. */
export const COLORS = [
  '#F08A8A', '#F3B562', '#7ED4A0', '#84AEF2',
  '#B49BE8', '#F09FC4', '#7CC7D6', '#A3AEBA',
]

/** Các mức thời hạn cho sẵn. Người dùng chọn chứ không gõ số. */
export const TTL_OPTIONS = [
  { hours: 0, label: L.ttl[0] },
  { hours: 6, label: L.ttl[1] },
  { hours: 24, label: L.ttl[2] },
  { hours: 72, label: L.ttl[3] },
  { hours: 168, label: L.ttl[4] },
  { hours: 720, label: L.ttl[5] },
] as const

export function ttlLabel(hours: number): string {
  return TTL_OPTIONS.find((t) => t.hours === hours)?.label ?? TTL_OPTIONS[0].label
}

const HOUR_MS = 3_600_000

/**
 * Bản ghi đã quá hạn chỉ bị XOÁ HẲN sau thêm khoảng dư này.
 *
 * Màn hình vẫn ẩn ngay lúc hết hạn (lọc lúc đọc). Khoảng dư chỉ để đồng hồ máy nhảy
 * nhầm tới tương lai không xoá vĩnh viễn dữ liệu — chỉnh giờ lại là trạm quay về.
 */
export const PRUNE_GRACE_MS = 24 * HOUR_MS

/**
 * Sổ nhóm: danh sách nhóm + thành viên.
 *
 * `members[groupId][entityId] = savedAt` (ms). savedAt = 0 nghĩa là bản ghi cũ không rõ
 * thời điểm lưu — coi như KHÔNG BAO GIỜ hết hạn.
 */
export interface GroupBook {
  groups: StationGroup[]
  members: Record<string, Record<string, number>>
}

export const EMPTY_BOOK: GroupBook = { groups: BUILT_IN, members: {} }

export function group(book: GroupBook, id: string): StationGroup | undefined {
  return book.groups.find((g) => g.id === id)
}

export function idsIn(book: GroupBook, groupId: string): string[] {
  return Object.keys(book.members[groupId] ?? {})
}

/** Trạm này đang nằm trong nhóm nào, theo thứ tự nhóm. */
export function groupsOf(book: GroupBook, entityId: string): string[] {
  return book.groups.filter((g) => entityId in (book.members[g.id] ?? {})).map((g) => g.id)
}

/** Tất cả trạm đã lưu, không phân biệt nhóm. */
export function allSaved(book: GroupBook): Set<string> {
  const out = new Set<string>()
  for (const m of Object.values(book.members)) for (const id of Object.keys(m)) out.add(id)
  return out
}

/** Mốc trạm rời nhóm (ms). null = không tự gỡ. */
export function expiresAt(book: GroupBook, groupId: string, entityId: string): number | null {
  const ttl = group(book, groupId)?.ttlHours ?? 0
  if (ttl <= 0) return null
  const at = book.members[groupId]?.[entityId]
  if (!at) return null
  return at + ttl * HOUR_MS
}

/** Mốc gần nhất trong mọi nhóm chứa trạm này. */
export function soonestExpiry(book: GroupBook, entityId: string): number | null {
  let best: number | null = null
  for (const gid of groupsOf(book, entityId)) {
    const at = expiresAt(book, gid, entityId)
    if (at !== null && (best === null || at < best)) best = at
  }
  return best
}

/**
 * Nhóm đại diện cho trạm trên bản đồ — một ghim chỉ đeo được một hình.
 * Nhóm TỰ TẠO ưu tiên (cụ thể hơn), rồi 'sẽ đến' > 'sao' > 'yêu thích'.
 */
export function pinGroupOf(book: GroupBook, entityId: string): string | null {
  const ids = groupsOf(book, entityId)
  if (ids.length === 0) return null
  const custom = book.groups.find((g) => !g.builtIn && ids.includes(g.id))
  if (custom) return custom.id
  for (const id of [PLANNED, STAR, FAVORITE]) if (ids.includes(id)) return id
  return ids[0]
}

/** Bỏ các thành viên đã hết hạn tại `now` (chỉ để HIỂN THỊ — không ghi xuống kho). */
export function alive(book: GroupBook, now: number): GroupBook {
  const members: GroupBook['members'] = {}
  for (const [gid, m] of Object.entries(book.members)) {
    const kept: Record<string, number> = {}
    for (const [id, at] of Object.entries(m)) {
      const exp = expiresAt(book, gid, id)
      if (exp === null || exp > now) kept[id] = at
    }
    members[gid] = kept
  }
  return { ...book, members }
}

// ------------------------------------------------------------ thao tác (bất biến)

export function toggleMembership(
  book: GroupBook,
  groupId: string,
  entityId: string,
  now: number,
): GroupBook {
  const m = { ...(book.members[groupId] ?? {}) }
  // Bản ghi đã hết hạn nhưng chưa bị dọn: người dùng không thấy nó, nên bấm là LƯU LẠI
  // (đồng hồ tính lại từ đầu) chứ không phải bỏ ra.
  const exp = expiresAt(book, groupId, entityId)
  const visible = entityId in m && (exp === null || exp > now)
  if (visible) delete m[entityId]
  else m[entityId] = now
  return { ...book, members: { ...book.members, [groupId]: m } }
}

export function removeFromAll(book: GroupBook, entityId: string): GroupBook {
  const members: GroupBook['members'] = {}
  for (const [gid, m] of Object.entries(book.members)) {
    if (!(entityId in m)) {
      members[gid] = m
      continue
    }
    const { [entityId]: _drop, ...rest } = m
    members[gid] = rest
  }
  return { ...book, members }
}

export function newCustomId(now: number): string {
  return `c${now.toString(36)}`
}

export function createGroup(
  book: GroupBook,
  g: Omit<StationGroup, 'id' | 'builtIn'>,
  now: number,
): { book: GroupBook; id: string } {
  let id = newCustomId(now)
  // Hai lần bấm trong cùng một mili giây — hiếm nhưng không được ghi đè nhóm cũ.
  while (group(book, id)) id += 'x'
  const created: StationGroup = { ...g, label: g.label.trim(), id, builtIn: false }
  return { book: { ...book, groups: sortGroups([...book.groups, created]) }, id }
}

/**
 * Đổi thời hạn tự gỡ của nhóm TỰ TẠO. Không đặt lại đồng hồ các trạm đang có: thời hạn
 * tính từ lúc LƯU, nên rút ngắn có thể làm trạm cũ hết hạn ngay — đúng ý người dùng.
 */
export function setGroupTtl(book: GroupBook, groupId: string, hours: number): GroupBook {
  return {
    ...book,
    groups: book.groups.map((g) => (g.id === groupId && !g.builtIn ? { ...g, ttlHours: hours } : g)),
  }
}

export function deleteGroup(book: GroupBook, groupId: string): GroupBook {
  if (BUILT_IN.some((g) => g.id === groupId)) return book
  const { [groupId]: _drop, ...members } = book.members
  return { groups: book.groups.filter((g) => g.id !== groupId), members }
}

/** Xoá hẳn bản ghi đã quá hạn hơn [PRUNE_GRACE_MS]. Trả về null nếu không có gì để xoá. */
export function pruneExpired(book: GroupBook, now: number): GroupBook | null {
  let removed = 0
  const members: GroupBook['members'] = {}
  for (const [gid, m] of Object.entries(book.members)) {
    const kept: Record<string, number> = {}
    for (const [id, at] of Object.entries(m)) {
      const exp = expiresAt(book, gid, id)
      if (exp !== null && exp + PRUNE_GRACE_MS <= now) removed++
      else kept[id] = at
    }
    members[gid] = kept
  }
  return removed > 0 ? { ...book, members } : null
}

/** Dựng sẵn trước, rồi nhóm tự tạo theo tên — thứ tự không nhảy khi thêm bớt. */
function sortGroups(groups: StationGroup[]): StationGroup[] {
  const custom = groups.filter((g) => !g.builtIn).sort((a, b) => a.label.localeCompare(b.label, 'vi'))
  return [...BUILT_IN, ...custom]
}

// ------------------------------------------------------------ lưu trữ

export const STORAGE_KEY = 'tramsac.groups'
/** Khoá danh sách yêu thích phẳng của bản 0.1–0.2. */
const LEGACY_FAVORITES_KEY = 'tramsac.favorites'

export interface StoredBook {
  v: 1
  groups: Array<Omit<StationGroup, 'builtIn'>>
  members: Record<string, Record<string, number>>
}

const VALID_ICONS = new Set<string>([...ICON_KEYS, 'heart', 'star', 'flag'])
const HEX = /^#[0-9a-fA-F]{6}$/
/** entityId của VinFast là số (xem parseStationId). */
const ENTITY_ID = /^\d{1,9}$/

/** Đọc từ JSON đã lưu. Dữ liệu hỏng thì lấy phần đọc được, không làm sập app. */
export function parseBook(raw: string | null): GroupBook {
  if (!raw) return EMPTY_BOOK
  try {
    return bookFromStored(JSON.parse(raw) as Partial<StoredBook>)
  } catch {
    return EMPTY_BOOK
  }
}

/**
 * Dựng sổ nhóm từ object đã parse (localStorage hoặc file / link sao lưu). Bỏ nhóm thiếu id,
 * icon lạ, thành viên của nhóm không tồn tại — dữ liệu từ ngoài vào cũng đi qua đây.
 */
export function bookFromStored(s: Partial<StoredBook>): GroupBook {
  const custom: StationGroup[] = (Array.isArray(s.groups) ? s.groups : [])
    .filter((g) => g && typeof g.id === 'string' && g.id && !BUILT_IN.some((b) => b.id === g.id))
    .map((g) => ({
      id: g.id.slice(0, 40),
      label: String(g.label ?? '').slice(0, 40),
      builtIn: false,
      iconKey: VALID_ICONS.has(g.iconKey) ? g.iconKey : 'bookmark',
      // Màu được chèn vào chuỗi SVG của ghim (pins.ts) — chỉ nhận đúng dạng #rrggbb.
      colorHex: typeof g.colorHex === 'string' && HEX.test(g.colorHex) ? g.colorHex : '#64748B',
      ttlHours: Number.isFinite(g.ttlHours) ? g.ttlHours : 0,
    }))
  const groups = sortGroups([...BUILT_IN, ...custom])
  const known = new Set(groups.map((g) => g.id))
  const members: GroupBook['members'] = {}
  for (const [gid, m] of Object.entries(s.members ?? {})) {
    if (!known.has(gid) || !m || typeof m !== 'object') continue
    const clean: Record<string, number> = {}
    for (const [id, at] of Object.entries(m)) {
      if (ENTITY_ID.test(id)) clean[id] = typeof at === 'number' && Number.isFinite(at) ? at : 0
    }
    members[gid] = clean
  }
  return { groups, members }
}

/** Dạng lưu kho / sao lưu: chỉ nhóm tự tạo (nhóm dựng sẵn dựng lại từ code). */
export function toStored(book: GroupBook): StoredBook {
  return {
    v: 1,
    groups: book.groups
      .filter((g) => !g.builtIn)
      .map(({ builtIn: _b, ...g }) => g),
    members: book.members,
  }
}

export function serializeBook(book: GroupBook): string {
  return JSON.stringify(toStored(book))
}

/**
 * Đọc sổ nhóm, kèm chuyển danh sách yêu thích cũ sang nhóm "favorite" (một lần).
 * Bản ghi chuyển sang có savedAt = 0 — nhóm yêu thích không có hạn nên không ảnh hưởng.
 */
export function loadBook(): GroupBook {
  try {
    let book = parseBook(readStr(STORAGE_KEY))
    if (readStr(LEGACY_FAVORITES_KEY)) {
      const ids = readJson(LEGACY_FAVORITES_KEY)
      if (Array.isArray(ids)) {
        const fav = { ...(book.members[FAVORITE] ?? {}) }
        for (const id of ids) if (typeof id === 'string' && !(id in fav)) fav[id] = 0
        book = { ...book, members: { ...book.members, [FAVORITE]: fav } }
      }
      writeStr(STORAGE_KEY, serializeBook(book))
      removeKey(LEGACY_FAVORITES_KEY)
    }
    return book
  } catch {
    return EMPTY_BOOK
  }
}

export function saveBook(book: GroupBook): void {
  writeStr(STORAGE_KEY, serializeBook(book)) // chế độ riêng tư / hết dung lượng: bỏ qua
}

/**
 * "2 ngày", "5 giờ", "12 phút" — còn bao lâu nữa thì hết hạn.
 * Một đơn vị, làm tròn LÊN: đặt 6 giờ xong mà hiện "còn 5 giờ" đọc như app ăn mất 1 tiếng.
 */
export function remaining(untilMs: number, now: number): string {
  const left = untilMs - now
  if (left <= 0) return L.underMinute
  const minutes = Math.floor(left / 60_000)
  if (minutes >= 1440) return L.days(Math.ceil(minutes / 1440))
  if (minutes >= 60) return L.hours(Math.ceil(minutes / 60))
  return L.minutes(Math.max(1, minutes))
}
