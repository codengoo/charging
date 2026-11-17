import { describe, expect, it } from 'vitest'
import {
  BUILT_IN,
  EMPTY_BOOK,
  FAVORITE,
  PLANNED,
  PRUNE_GRACE_MS,
  STAR,
  alive,
  allSaved,
  bookFromStored,
  createGroup,
  deleteGroup,
  expiresAt,
  groupsOf,
  newCustomId,
  parseBook,
  pinGroupOf,
  pruneExpired,
  remaining,
  removeFromAll,
  serializeBook,
  setGroupTtl,
  soonestExpiry,
  toggleMembership,
  ttlLabel,
  type GroupBook,
} from '@/data/groups'

const H = 3_600_000
const NOW = Date.UTC(2026, 10, 17, 12)

/** Sổ có một nhóm tự tạo hạn 6 giờ. */
function withTimed(): { book: GroupBook; id: string } {
  return createGroup(EMPTY_BOOK, { label: '  Đi Hạ Long ', iconKey: 'place', colorHex: '#7ED4A0', ttlHours: 6 }, NOW)
}

describe('createGroup / deleteGroup / setGroupTtl', () => {
  it('id từ đồng hồ, cắt khoảng trắng tên, xếp sau nhóm dựng sẵn', () => {
    const { book, id } = withTimed()
    expect(id).toBe(newCustomId(NOW))
    expect(book.groups.map((g) => g.id)).toEqual([FAVORITE, STAR, PLANNED, id])
    expect(book.groups[3]).toMatchObject({ label: 'Đi Hạ Long', builtIn: false, ttlHours: 6 })
  })
  it('trùng mili giây không ghi đè nhóm cũ', () => {
    const a = withTimed()
    const b = createGroup(a.book, { label: 'B', iconKey: 'bolt', colorHex: '#F08A8A', ttlHours: 0 }, NOW)
    expect(b.id).toBe(a.id + 'x')
    expect(b.book.groups).toHaveLength(5)
  })
  it('không xoá / đổi hạn nhóm dựng sẵn', () => {
    expect(deleteGroup(EMPTY_BOOK, FAVORITE)).toBe(EMPTY_BOOK)
    expect(setGroupTtl(EMPTY_BOOK, FAVORITE, 6).groups[0].ttlHours).toBe(0)
    const { book, id } = withTimed()
    const withMember = toggleMembership(book, id, '1', NOW)
    const del = deleteGroup(withMember, id)
    expect(del.groups).toHaveLength(3)
    expect(del.members[id]).toBeUndefined()
    expect(setGroupTtl(book, id, 24).groups[3].ttlHours).toBe(24)
  })
})

describe('toggleMembership', () => {
  it('bấm lần 1 lưu với savedAt = now, lần 2 bỏ', () => {
    const b1 = toggleMembership(EMPTY_BOOK, FAVORITE, '123', NOW)
    expect(b1.members[FAVORITE]).toEqual({ '123': NOW })
    const b2 = toggleMembership(b1, FAVORITE, '123', NOW + 1)
    expect(b2.members[FAVORITE]).toEqual({})
    expect(EMPTY_BOOK.members).toEqual({}) // bất biến
  })
  it('mục đã hết hạn (chưa dọn) → bấm là LƯU LẠI, đồng hồ tính lại', () => {
    const { book, id } = withTimed()
    const saved = toggleMembership(book, id, '5', NOW)
    const later = NOW + 7 * H
    const again = toggleMembership(saved, id, '5', later)
    expect(again.members[id]).toEqual({ '5': later })
  })
  it('mục còn hạn → bỏ', () => {
    const { book, id } = withTimed()
    const saved = toggleMembership(book, id, '5', NOW)
    expect(toggleMembership(saved, id, '5', NOW + 5 * H).members[id]).toEqual({})
  })
})

describe('expiresAt / alive / soonestExpiry', () => {
  it('nhóm không hạn hoặc savedAt 0 → null', () => {
    const b = toggleMembership(EMPTY_BOOK, FAVORITE, '1', NOW)
    expect(expiresAt(b, FAVORITE, '1')).toBeNull()
    const { book, id } = withTimed()
    const legacy: GroupBook = { ...book, members: { [id]: { '1': 0 } } }
    expect(expiresAt(legacy, id, '1')).toBeNull()
  })
  it('alive ẩn mục quá hạn nhưng không đụng tới sổ gốc', () => {
    const { book, id } = withTimed()
    const b = toggleMembership(toggleMembership(book, id, '1', NOW), FAVORITE, '1', NOW)
    expect(expiresAt(b, id, '1')).toBe(NOW + 6 * H)
    const shown = alive(b, NOW + 6 * H)
    expect(shown.members[id]).toEqual({})
    expect(shown.members[FAVORITE]).toEqual({ '1': NOW })
    expect(b.members[id]).toEqual({ '1': NOW })
  })
  it('soonestExpiry lấy mốc gần nhất', () => {
    const { book, id } = withTimed()
    const b = toggleMembership(toggleMembership(book, id, '1', NOW), FAVORITE, '1', NOW)
    expect(soonestExpiry(b, '1')).toBe(NOW + 6 * H)
    expect(soonestExpiry(b, '2')).toBeNull()
  })
})

describe('pruneExpired', () => {
  it('chỉ xoá hẳn sau khoảng dư PRUNE_GRACE_MS', () => {
    const { book, id } = withTimed()
    const b = toggleMembership(book, id, '1', NOW)
    const exp = NOW + 6 * H
    expect(pruneExpired(b, exp + PRUNE_GRACE_MS - 1)).toBeNull()
    expect(pruneExpired(b, exp + PRUNE_GRACE_MS)!.members[id]).toEqual({})
  })
  it('không có gì để xoá → null', () => {
    expect(pruneExpired(toggleMembership(EMPTY_BOOK, FAVORITE, '1', NOW), NOW + 1000 * H)).toBeNull()
  })
})

describe('groupsOf / allSaved / removeFromAll / pinGroupOf', () => {
  const { book, id } = withTimed()
  const b = [FAVORITE, STAR, id].reduce((acc, g) => toggleMembership(acc, g, '1', NOW), book)
  it('groupsOf theo thứ tự nhóm, allSaved', () => {
    expect(groupsOf(b, '1')).toEqual([FAVORITE, STAR, id])
    expect(allSaved(b).has('2')).toBe(false)
    expect([...allSaved(toggleMembership(b, PLANNED, '9', NOW))].sort()).toEqual(['1', '9'])
  })
  it('pinGroupOf: tự tạo > sẽ đến > sao > yêu thích', () => {
    expect(pinGroupOf(b, '1')).toBe(id)
    const builtOnly = toggleMembership(toggleMembership(EMPTY_BOOK, FAVORITE, '1', NOW), STAR, '1', NOW)
    expect(pinGroupOf(builtOnly, '1')).toBe(STAR)
    expect(pinGroupOf(builtOnly, '2')).toBeNull()
  })
  it('removeFromAll bỏ khỏi mọi nhóm', () => {
    const r = removeFromAll(b, '1')
    expect(allSaved(r).has('1')).toBe(false)
    expect(r.groups).toBe(b.groups)
  })
})

describe('bookFromStored / parseBook / serializeBook', () => {
  it('làm sạch colorHex, icon, id trạm, nhóm lạ', () => {
    const b = bookFromStored({
      groups: [
        { id: 'c1', label: 'X', iconKey: 'bolt', colorHex: '#123456"/><script>', ttlHours: 6 },
        { id: 'c2', label: 'Y', iconKey: 'unknown' as never, colorHex: '#abcdef', ttlHours: NaN },
        { id: FAVORITE, label: 'hack', iconKey: 'heart', colorHex: '#000000', ttlHours: 1 },
        { id: '', label: 'no id', iconKey: 'bolt', colorHex: '#000000', ttlHours: 0 },
      ],
      members: { c1: { '123': 5, abc: 1, '456': 'x' as never }, ghost: { '1': 1 }, [FAVORITE]: { '7': 1 } },
    })
    expect(b.groups.map((g) => g.id)).toEqual([FAVORITE, STAR, PLANNED, 'c1', 'c2'])
    expect(b.groups[0]).toEqual(BUILT_IN[0])
    expect(b.groups[3].colorHex).toBe('#64748B')
    expect(b.groups[4]).toMatchObject({ iconKey: 'bookmark', colorHex: '#abcdef', ttlHours: 0 })
    expect(b.members).toEqual({ c1: { '123': 5, '456': 0 }, [FAVORITE]: { '7': 1 } })
  })
  it('khứ hồi serialize → parse', () => {
    const { book, id } = withTimed()
    const b = toggleMembership(toggleMembership(book, id, '42', NOW), FAVORITE, '7', NOW)
    expect(parseBook(serializeBook(b))).toEqual(b)
    expect(JSON.parse(serializeBook(b)).groups[0]).not.toHaveProperty('builtIn')
  })
  it('null / JSON hỏng → EMPTY_BOOK', () => {
    expect(parseBook(null)).toBe(EMPTY_BOOK)
    expect(parseBook('{bad')).toBe(EMPTY_BOOK)
  })
})

describe('remaining / ttlLabel', () => {
  it('một đơn vị, làm tròn lên', () => {
    expect(remaining(NOW + 6 * H, NOW)).toBe('6 giờ')
    expect(remaining(NOW + 5 * H + 60_000, NOW)).toBe('6 giờ')
    expect(remaining(NOW + 25 * H, NOW)).toBe('2 ngày')
    expect(remaining(NOW + 30_000, NOW)).toBe('1 phút')
    expect(remaining(NOW, NOW)).toBe('dưới 1 phút')
  })
  it('ttlLabel; mức lạ → "Không tự gỡ"', () => {
    expect(ttlLabel(24)).toBe('1 ngày')
    expect(ttlLabel(5)).toBe('Không tự gỡ')
  })
})
