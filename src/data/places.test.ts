import { describe, expect, it } from 'vitest'
import { PLACES_CUSTOM_MAX, PLACE_NAME_MAX, mergePlaces, newPlacesCount, parsePlaces, placeName, type Place } from '@/data/places'

const P = (o: Partial<Place>): Place => ({ id: 'home', kind: 'home', name: '', lat: 21, lng: 105.8, address: '', at: 1, ...o })

describe('parsePlaces', () => {
  it('bỏ mục sai kiểu / toạ độ hỏng / địa điểm tự đặt không tên', () => {
    expect(parsePlaces(null)).toEqual([])
    expect(parsePlaces({})).toEqual([])
    expect(parsePlaces([P({ lat: 200 }), P({ kind: 'x' as never }), P({ id: 'c1', kind: 'custom', name: '  ' }), 'rác'])).toEqual([])
  })
  it('Nhà / Công ty mỗi loại một (giữ bản sửa sau), id theo loại; xếp Nhà → Công ty → tự đặt', () => {
    const list = parsePlaces([
      P({ id: 'c1', kind: 'custom', name: 'Quê', at: 3 }),
      P({ id: 'whatever', kind: 'work', at: 2 }),
      P({ kind: 'home', address: 'cũ', at: 1 }),
      P({ kind: 'home', address: 'mới', at: 4 }),
    ])
    expect(list.map((p) => [p.id, p.address || p.name])).toEqual([
      ['home', 'mới'],
      ['work', ''],
      ['c1', 'Quê'],
    ])
  })
  it(`cắt tên dài, tối đa ${PLACES_CUSTOM_MAX} địa điểm tự đặt`, () => {
    const many = Array.from({ length: PLACES_CUSTOM_MAX + 3 }, (_, i) => P({ id: `c${i}`, kind: 'custom', name: 'x'.repeat(50), at: i }))
    const list = parsePlaces(many)
    expect(list).toHaveLength(PLACES_CUSTOM_MAX)
    expect(list[0].name).toHaveLength(PLACE_NAME_MAX)
  })
})

describe('mergePlaces / newPlacesCount', () => {
  it('chỉ có một bên thì lấy, cùng id giữ bản sửa sau', () => {
    const mine = [P({ address: 'A', at: 5 }), P({ id: 'c1', kind: 'custom', name: 'Quê', at: 1 })]
    const incoming = [P({ address: 'B', at: 3 }), P({ id: 'c1', kind: 'custom', name: 'Quê mới', at: 9 }), P({ id: 'work', kind: 'work', at: 2 })]
    expect(mergePlaces(mine, incoming).map((p) => p.address || p.name)).toEqual(['A', '', 'Quê mới'])
    expect(newPlacesCount(mine, incoming)).toBe(2)
  })
})

describe('placeName', () => {
  it('Nhà / Công ty theo ngôn ngữ, tự đặt theo tên', () => {
    expect(placeName({ kind: 'home', name: '' })).toBe('Nhà')
    expect(placeName({ kind: 'work', name: '' })).toBe('Công ty')
    expect(placeName({ kind: 'custom', name: 'Quê' })).toBe('Quê')
  })
})
