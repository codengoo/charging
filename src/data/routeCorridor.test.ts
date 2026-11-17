import { describe, expect, it } from 'vitest'
import {
  ALONG_ROUTE_LIMIT,
  alongRoute,
  corridorCells,
  pickAlongRoute,
  routeBounds,
  thinRoute,
} from '@/data/routeCorridor'
import type { RoutePath } from '@/data/tripTypes'
import { cellOf, type StationIndex } from '@/data/stations'
import { foldText } from '@/lib/text'
import type { Station } from '@/data/types'
import type { GeoPoint } from '@/lib/geo'

const KM_PER_LAT = 110.574
const LNG0 = 105.9
const LAT0 = 20.5
// Tuyến thẳng hướng BẮC dọc kinh độ 105.9, 51 điểm cách 0,01° (~1,1 km) → ~55 km.
const NORTH: GeoPoint[] = Array.from({ length: 51 }, (_, i) => ({ lat: LAT0 + i * 0.01, lng: LNG0 }))
const KX = 111.32 * Math.cos((NORTH[25].lat * Math.PI) / 180)
/** Kinh độ lệch `km` về phía ĐÔNG (bên PHẢI khi đi hướng bắc); âm = phía tây (bên trái). */
const east = (km: number) => LNG0 + km / KX

function st(id: string, lat: number, lng: number, status: Station['status'] = 0): Station {
  return {
    entityId: id,
    storeId: id,
    name: id,
    address: '',
    lat,
    lng,
    cell: cellOf(lat, lng),
    searchKey: foldText(id),
    isPublic: true,
    parkingFee: false,
    hasLink: false,
    availableDate: null,
    status,
  }
}

function indexOf(all: Station[]): StationIndex {
  const byCell = new Map<number, Station[]>()
  for (const s of all) byCell.set(s.cell, [...(byCell.get(s.cell) ?? []), s])
  return {
    all,
    byId: new Map(all.map((s) => [s.entityId, s])),
    byCell,
    generation: 1,
    builtAt: '',
    manifest: { generation: 1, builtAt: '', base: '', power: '', counts: { stations: all.length, enriched: 0 } },
  }
}

const road = (limited: boolean) => ({ points: NORTH, limited: NORTH.map(() => limited) })

describe('thinRoute', () => {
  it('≤ 2 điểm giữ nguyên, cờ thiếu → false', () => {
    const pts = [NORTH[0], NORTH[1]]
    expect(thinRoute(pts, [true])).toEqual({ points: pts, limited: [true, false] })
  })
  it('lấy mẫu theo bước 0,25 km, giữ điểm đầu/cuối, cờ dài bằng điểm', () => {
    // 41 điểm cách 0,1 km (4 km).
    const pts = Array.from({ length: 41 }, (_, i) => ({ lat: LAT0 + (i * 0.1) / KM_PER_LAT, lng: LNG0 }))
    const t = thinRoute(pts, pts.map(() => false))
    expect(t.points[0]).toBe(pts[0])
    expect(t.points[t.points.length - 1]).toBe(pts[40])
    expect(t.limited).toHaveLength(t.points.length)
    expect(t.points.length).toBeLessThan(pts.length)
    expect(t.points[1]).toBe(pts[3]) // 0,3 km ≥ 0,25
  })
  it('điểm cao tốc bị bỏ thì cờ dồn sang điểm giữ lại kế tiếp', () => {
    const pts = Array.from({ length: 41 }, (_, i) => ({ lat: LAT0 + (i * 0.1) / KM_PER_LAT, lng: LNG0 }))
    const flags = pts.map((_, i) => i === 2)
    const t = thinRoute(pts, flags)
    // Điểm 2 bị bỏ, điểm 3 giữ lại mang cờ của đoạn gộp 1..3.
    expect(t.points[1]).toBe(pts[3])
    expect(t.limited[1]).toBe(true)
    expect(t.limited.filter(Boolean)).toHaveLength(1)
  })
})

describe('corridorCells', () => {
  it('đệm ceil(r/10) ô mỗi phía', () => {
    expect(corridorCells([{ lat: 21.05, lng: 105.85 }], 2)).toHaveLength(9)
    expect(corridorCells([{ lat: 21.05, lng: 105.85 }], 10)).toHaveLength(9)
    expect(corridorCells([{ lat: 21.05, lng: 105.85 }], 15)).toHaveLength(25)
  })
  it('chứa ô của chính điểm, gộp ô trùng', () => {
    const cells = corridorCells([{ lat: 21.05, lng: 105.85 }, { lat: 21.06, lng: 105.86 }], 2)
    expect(cells).toContain(cellOf(21.05, 105.85))
    expect(cells).toHaveLength(9)
  })
})

describe('pickAlongRoute', () => {
  it('trạm ngoài bán kính bị loại; trong thì có atKm / offsetKm, sắp theo atKm', () => {
    const s = [st('later', 20.8, east(1)), st('first', 20.6, east(0.5)), st('far', 20.7, east(3))]
    const r = pickAlongRoute(road(false), s, 2)
    expect(r.map((x) => x.station.entityId)).toEqual(['first', 'later'])
    expect(r[0].atKm).toBeCloseTo(0.1 * KM_PER_LAT, 3)
    expect(r[0].offsetKm).toBeCloseTo(0.5, 3)
    expect(r[1].atKm).toBeCloseTo(0.3 * KM_PER_LAT, 3)
    expect(r.every((x) => !x.viaExit)).toBe(true)
  })
  it('cao tốc: trạm sát bên TRÁI (bên kia dải phân cách) bị loại; đường thường thì giữ', () => {
    const s = [st('left', 20.7, east(-0.1))]
    expect(pickAlongRoute(road(true), s, 2)).toEqual([])
    expect(pickAlongRoute(road(false), s, 2)).toHaveLength(1)
  })
  it('cao tốc: bên phải ≤ 150 m là trạm dừng nghỉ (không viaExit); xa hơn hoặc bên trái xa → viaExit', () => {
    const s = [st('rest', 20.6, east(0.1)), st('village', 20.7, east(0.5)), st('leftFar', 20.8, east(-0.5))]
    const r = pickAlongRoute(road(true), s, 2)
    expect(r.map((x) => [x.station.entityId, x.viaExit])).toEqual([
      ['rest', false],
      ['village', true],
      ['leftFar', true],
    ])
  })
  it('tuyến < 2 điểm hoặc không có trạm → []', () => {
    expect(pickAlongRoute({ points: [NORTH[0]], limited: [false] }, [st('a', LAT0, LNG0)], 2)).toEqual([])
    expect(pickAlongRoute(road(false), [], 2)).toEqual([])
  })
})

describe('routeBounds', () => {
  it('rỗng → null; nới 12% (tối thiểu 0,01°)', () => {
    expect(routeBounds([])).toBeNull()
    const b = routeBounds([{ lat: 21, lng: 105 }])!
    expect(b[0][0]).toBeCloseTo(104.99, 9)
    expect(b[1][1]).toBeCloseTo(21.01, 9)
    const c = routeBounds(NORTH)!
    expect(c[0][1]).toBeCloseTo(LAT0 - 0.5 * 0.12, 9)
    expect(c[1][1]).toBeCloseTo(LAT0 + 0.5 + 0.5 * 0.12, 9)
  })
})

describe('alongRoute', () => {
  const route: RoutePath = { points: NORTH, limited: NORTH.map(() => false), meters: 55_000, seconds: 3600 }
  it('bỏ trạm không hoạt động, áp `keep` trước trần', () => {
    const idx = indexOf([st('ok', 20.6, east(0.5)), st('maint', 20.7, east(0.5), 1), st('skip', 20.8, east(0.5))])
    const r = alongRoute(idx, route, 2, (s) => s.entityId !== 'skip')
    expect(r.total).toBe(1)
    expect(r.items.map((x) => x.station.entityId)).toEqual(['ok'])
  })
  it('vượt trần thì bỏ trạm lệch xa nhất, giữ thứ tự theo km', () => {
    const idx = indexOf([
      st('a', 20.55, east(1.5)),
      st('b', 20.65, east(0.2)),
      st('c', 20.75, east(1.8)),
      st('d', 20.85, east(0.4)),
      st('e', 20.95, east(0.6)),
    ])
    const r = alongRoute(idx, route, 2, undefined, 3)
    expect(r.total).toBe(5)
    expect(r.items.map((x) => x.station.entityId)).toEqual(['b', 'd', 'e'])
  })
  it('trần mặc định là 400', () => {
    expect(ALONG_ROUTE_LIMIT).toBe(400)
    const many = Array.from({ length: 405 }, (_, i) => st(String(i), LAT0 + 0.01 + i * 0.001, east(0.1 + (i % 10) * 0.1)))
    const r = alongRoute(indexOf(many), route, 2)
    expect(r.total).toBe(405)
    expect(r.items).toHaveLength(400)
    for (let i = 1; i < r.items.length; i++) expect(r.items[i].atKm).toBeGreaterThanOrEqual(r.items[i - 1].atKm)
  })
})
