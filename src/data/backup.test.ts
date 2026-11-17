import { describe, expect, it } from 'vitest'
import { IMPORT_HASH, backupUrl, decodeBackup, diffCount, encodeBackup, mergeBooks, toBackup } from '@/data/backup'
import { EMPTY_BOOK, FAVORITE, STAR, createGroup, toggleMembership, type GroupBook } from '@/data/groups'
import type { NoteMap } from '@/data/notes'

const NOW = Date.UTC(2026, 10, 17, 12)

function sample(): { book: GroupBook; id: string } {
  const { book, id } = createGroup(EMPTY_BOOK, { label: 'Hạ Long', iconKey: 'place', colorHex: '#7ED4A0', ttlHours: 24 }, NOW)
  return { book: toggleMembership(toggleMembership(book, id, '42', NOW), FAVORITE, '7', NOW - 1000), id }
}
const NOTES: NoteMap = { '7': { text: 'cổng 2 hay lỗi', at: NOW } }

/** `j.<base64url(json)>` dựng tay (đường dự phòng khi không có CompressionStream). */
function jPayload(o: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(o))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return 'j.' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('toBackup', () => {
  it('có kind, bỏ nhóm dựng sẵn, notes chỉ khi có', () => {
    const { book, id } = sample()
    const b = toBackup(book, {})
    expect(b.kind).toBe('tramsac.groups')
    expect(b.v).toBe(1)
    expect(b.groups.map((g) => g.id)).toEqual([id])
    expect(b).not.toHaveProperty('notes')
    expect(toBackup(book, NOTES).notes).toEqual(NOTES)
  })
})

describe('encodeBackup / decodeBackup', () => {
  it('khứ hồi qua deflate-raw (z.)', async () => {
    const { book } = sample()
    const s = await encodeBackup(toBackup(book, NOTES))
    expect(s.startsWith('z.')).toBe(true)
    expect(s).toMatch(/^z\.[A-Za-z0-9_-]+$/)
    expect(await decodeBackup(s)).toEqual({ book, notes: NOTES, places: [] })
  })
  it('j. (JSON thô) cũng đọc được; file sửa tay thiếu kind vẫn nhận', async () => {
    const r = await decodeBackup(jPayload({ members: { favorite: { '9': 1 } } }))
    expect(r?.book.members).toEqual({ favorite: { '9': 1 } })
    expect(r?.notes).toEqual({})
  })
  it('hỏng / sai kind / không có gì → null', async () => {
    expect(await decodeBackup('z.@@@')).toBeNull()
    expect(await decodeBackup('x.abc')).toBeNull()
    expect(await decodeBackup(jPayload({ kind: 'other', groups: [] }))).toBeNull()
    expect(await decodeBackup(jPayload({ hello: 1 }))).toBeNull()
    expect(await decodeBackup(jPayload([1, 2]))).toBeNull()
  })
  it('backupUrl đặt payload trong hash', async () => {
    const url = await backupUrl('https://charging.cangao.asia', EMPTY_BOOK, {})
    expect(url.startsWith(`https://charging.cangao.asia/${IMPORT_HASH}z.`)).toBe(true)
  })
})

describe('mergeBooks', () => {
  it('thêm nhóm + trạm mới; trạm đã có giữ savedAt của máy này; nhóm trùng id giữ tên máy này', () => {
    const { book, id } = sample()
    const incoming: GroupBook = {
      groups: [...book.groups.slice(0, 3), { ...book.groups[3], label: 'Tên khác' }, { id: 'cz', label: 'Mới', builtIn: false, iconKey: 'bolt', colorHex: '#F08A8A', ttlHours: 0 }],
      members: { [FAVORITE]: { '7': 1, '8': 2 }, cz: { '100': 3 }, [STAR]: { '9': 4 } },
    }
    const m = mergeBooks(book, incoming)
    expect(m.groups.map((g) => g.id)).toEqual([FAVORITE, STAR, 'planned', id, 'cz'])
    expect(m.groups.find((g) => g.id === id)!.label).toBe('Hạ Long')
    expect(m.members[FAVORITE]).toEqual({ '7': NOW - 1000, '8': 2 })
    expect(m.members[STAR]).toEqual({ '9': 4 })
    expect(m.members.cz).toEqual({ '100': 3 })
    expect(m.members[id]).toEqual({ '42': NOW })
  })
  it('gộp với chính nó không đổi gì', () => {
    const { book } = sample()
    expect(mergeBooks(book, book)).toEqual(book)
  })
})

describe('diffCount', () => {
  it('đếm trạm mới (theo nhóm), nhóm mới, ghi chú mới / mới hơn', () => {
    const { book } = sample()
    const incoming: GroupBook = {
      groups: [...book.groups, { id: 'cz', label: 'Mới', builtIn: false, iconKey: 'bolt', colorHex: '#F08A8A', ttlHours: 0 }],
      members: { [FAVORITE]: { '7': 1, '8': 2 }, [STAR]: { '7': 1 }, cz: { '8': 1 } },
    }
    const notes: NoteMap = { '7': { text: 'mới hơn', at: NOW + 1 }, '8': { text: 'x', at: 1 } }
    expect(diffCount(book, NOTES, { book: incoming, notes, places: [] })).toEqual({ stations: 2, groups: 1, notes: 2, places: 0 })
  })
  it('bản sao lưu giống hệt → toàn 0', () => {
    const { book } = sample()
    expect(diffCount(book, NOTES, { book, notes: NOTES, places: [] })).toEqual({ stations: 0, groups: 0, notes: 0, places: 0 })
  })
  it('địa điểm: mang theo trong sao lưu, đếm cái mới / mới hơn', async () => {
    const { book } = sample()
    const home = { id: 'home', kind: 'home' as const, name: '', lat: 21, lng: 105.8, address: 'A', at: 5 }
    const s = await encodeBackup(toBackup(book, NOTES, [home]))
    const back = await decodeBackup(s)
    expect(back?.places).toEqual([home])
    expect(diffCount(book, NOTES, back!, [])).toMatchObject({ places: 1 })
    expect(diffCount(book, NOTES, back!, [{ ...home, at: 9 }])).toMatchObject({ places: 0 })
  })
})
