import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  bandOf,
  cellOf,
  distanceKm,
  foldText,
  kwActive,
  kwLabel,
  nearestStations,
  passesFilters,
  searchStations,
  stationsInBounds,
  statusOf,
  tierOf,
  type StationIndex,
} from '@/data/stations'
import type { Station, StationPower, StationStatus } from '@/data/types'

function st(id: string, lat: number, lng: number, extra: Partial<Station> = {}): Station {
  const name = extra.name ?? `Trạm ${id}`
  return {
    entityId: id,
    storeId: `s${id}`,
    name,
    address: extra.address ?? '',
    lat,
    lng,
    cell: cellOf(lat, lng),
    searchKey: foldText(name + ' ' + (extra.address ?? '')),
    isPublic: true,
    parkingFee: false,
    hasLink: false,
    availableDate: null,
    status: 0,
    ...extra,
  }
}

function indexOf(all: Station[]): StationIndex {
  const byId = new Map<string, Station>()
  const byCell = new Map<number, Station[]>()
  for (const s of all) {
    byId.set(s.entityId, s)
    const b = byCell.get(s.cell)
    if (b) b.push(s)
    else byCell.set(s.cell, [s])
  }
  return {
    all,
    byId,
    byCell,
    generation: 1,
    builtAt: '2026-11-17',
    manifest: { generation: 1, builtAt: '2026-11-17', base: 'b', power: 'p', counts: { stations: all.length, enriched: 0 } },
  }
}

const power = (groups: StationPower['groups']): StationPower => ({
  portCount: groups.reduce((n, g) => n + g.count, 0),
  maxKw: groups.reduce((m, g) => Math.max(m, g.kw), 0),
  dcCount: groups.filter((g) => g.dc).reduce((n, g) => n + g.count, 0),
  groups,
})

describe('cellOf / foldText / distanceKm', () => {
  it('cellOf theo ô 0,1°', () => {
    expect(cellOf(21.05, 105.85)).toBe((210 + 1000) * 100_000 + (1058 + 2000))
    expect(cellOf(21.05, 105.85)).toBe(cellOf(21.01, 105.89))
    expect(cellOf(21.05, 105.85)).not.toBe(cellOf(21.15, 105.85))
  })
  it('foldText hạ dấu, gộp khoảng trắng', () => {
    expect(foldText('  Đường   Láng  Hà Nội ')).toBe('duong lang ha noi')
  })
  it('distanceKm: 1° vĩ độ ≈ 111,2 km', () => {
    expect(distanceKm(21, 105, 22, 105)).toBeCloseTo(111.19, 1)
    expect(distanceKm(21, 105, 21, 105)).toBe(0)
  })
})

describe('stationsInBounds / searchStations', () => {
  const idx = indexOf([st('1', 21.03, 105.85, { name: 'Vincom Bà Triệu' }), st('2', 21.25, 105.85), st('3', 21.03, 106.3)])
  it('trả trạm trong các ô phủ khung nhìn', () => {
    expect(stationsInBounds(idx, 105.8, 21.0, 105.9, 21.1).map((s) => s.entityId)).toEqual(['1'])
  })
  it('tìm không dấu, mọi từ phải khớp; chuỗi rỗng → []', () => {
    expect(searchStations(idx, 'vincom ba trieu').map((s) => s.entityId)).toEqual(['1'])
    expect(searchStations(idx, 'vincom xyz')).toEqual([])
    expect(searchStations(idx, '   ')).toEqual([])
  })
})

describe('nearestStations', () => {
  it('sắp theo khoảng cách, cắt theo limit, có distanceKm', () => {
    const idx = indexOf([st('far', 21.08, 105.85), st('near', 21.051, 105.85), st('mid', 21.06, 105.85)])
    const r = nearestStations(idx, 21.05, 105.85, 2)
    expect(r.map((s) => s.entityId)).toEqual(['near', 'mid'])
    expect(r[0].distanceKm).toBeCloseTo(0.111, 2)
  })
  it('predicate lọc trước khi đếm', () => {
    const idx = indexOf([st('a', 21.051, 105.85, { status: 1 }), st('b', 21.06, 105.85)])
    expect(nearestStations(idx, 21.05, 105.85, 1, (s) => s.status === 0).map((s) => s.entityId)).toEqual(['b'])
  })
  it('mở rộng vòng khi vòng đầu chưa đủ; hết maxRing thì trả những gì có', () => {
    const idx = indexOf([st('x', 21.35, 105.85)])
    expect(nearestStations(idx, 21.05, 105.85, 1).map((s) => s.entityId)).toEqual(['x'])
    expect(nearestStations(idx, 21.05, 105.85, 5, undefined, 2)).toEqual([])
    expect(nearestStations(idx, 21.05, 105.85, 5, undefined, 4).map((s) => s.entityId)).toEqual(['x'])
  })
  // B1: điều kiện dừng dùng deg*111 cho cả kinh độ (thiếu cos(lat)). Ở 21°N, 0,1° kinh độ chỉ
  // ~10,4 km — trạm A ở phía bắc 10,8 km (trong vòng 1, dưới 11,1 km) làm vòng lặp dừng, bỏ sót
  // trạm B phía đông chỉ cách 10,5 km nhưng nằm ở ô ngoài vòng 1. Phase 03 sửa → bỏ `.fails`.
  it.fails('B1 nearestStations bỏ sót trạm gần hơn lệch đông-tây', () => {
    const user = { lat: 21.05, lng: 105.899 }
    const A = st('A', 21.147, 105.899)
    const B = st('B', 21.05, 106.0005)
    expect(distanceKm(user.lat, user.lng, B.lat, B.lng)).toBeLessThan(distanceKm(user.lat, user.lng, A.lat, A.lng))
    const r = nearestStations(indexOf([A, B]), user.lat, user.lng, 1)
    expect(r[0].entityId).toBe('B')
  })
})

describe('statusOf', () => {
  it('theo base khi không có depotStatus', () => {
    const k: Array<[StationStatus, string]> = [[0, 'active'], [1, 'maintaining'], [2, 'out'], [3, 'planned']]
    for (const [s, want] of k) expect(statusOf(st('1', 21, 105, { status: s }))).toBe(want)
  })
  it('depotStatus live đè base', () => {
    expect(statusOf(st('1', 21, 105), 'AllBusy')).toBe('busy')
    expect(statusOf(st('1', 21, 105, { status: 2 }), 'Available')).toBe('active')
  })
  it('depotStatus lạ / kế thừa prototype → về base', () => {
    expect(statusOf(st('1', 21, 105, { status: 1 }), 'Weird')).toBe('maintaining')
    expect(statusOf(st('1', 21, 105), 'toString')).toBe('active')
    expect(statusOf(st('1', 21, 105, { status: 3 }), null)).toBe('planned')
  })
})

describe('tierOf / bandOf', () => {
  it('tierOf theo cổng DC mạnh nhất', () => {
    expect(tierOf(undefined)).toBe(0)
    expect(tierOf(power([{ kw: 11, count: 2, dc: false }]))).toBe(0)
    expect(tierOf(power([{ kw: 11, count: 2, dc: false }, { kw: 60, count: 1, dc: true }]))).toBe(1)
    expect(tierOf(power([{ kw: 150, count: 1, dc: true }]))).toBe(2)
  })
  it('bandOf theo cổng mạnh nhất (AC lẫn DC)', () => {
    expect(bandOf(undefined)).toBeNull()
    expect(bandOf(power([{ kw: 11, count: 2, dc: false }]))).toBe('low')
    expect(bandOf(power([{ kw: 60, count: 2, dc: true }]))).toBe('mid')
    expect(bandOf(power([{ kw: 120, count: 2, dc: true }]))).toBe('hi')
  })
})

describe('kwLabel / kwActive', () => {
  it('rỗng hoặc đủ 3 mức = không lọc', () => {
    expect(kwActive([])).toBe(false)
    expect(kwActive(['hi', 'mid', 'low'])).toBe(false)
    expect(kwLabel([])).toBe('Công suất')
    expect(kwLabel(['low', 'mid', 'hi'])).toBe('Công suất')
  })
  it('gộp các mức liền nhau', () => {
    expect(kwLabel(['hi', 'mid'])).toBe('≥ 60 kW')
    expect(kwLabel(['mid', 'low'])).toBe('< 120 kW')
    expect(kwLabel(['hi', 'low'])).toBe('≥ 120 · < 60 kW')
  })
  it('một mức', () => {
    expect(kwLabel(['hi'])).toBe('≥ 120 kW')
    expect(kwLabel(['mid'])).toBe('60–119 kW')
    expect(kwLabel(['low'])).toBe('< 60 kW')
  })
})

describe('passesFilters', () => {
  const s = st('7', 21, 105, { status: 1 })
  const pw = new Map([['7', power([{ kw: 60, count: 2, dc: true }])]])
  it('mặc định cho qua hết', () => {
    expect(passesFilters(s, DEFAULT_FILTERS, null)).toBe(true)
  })
  it('favoritesOnly cần saved; activeOnly loại trạm không hoạt động', () => {
    expect(passesFilters(s, { ...DEFAULT_FILTERS, favoritesOnly: true }, null)).toBe(false)
    expect(passesFilters(s, { ...DEFAULT_FILTERS, favoritesOnly: true }, null, new Set(['7']))).toBe(true)
    expect(passesFilters(s, { ...DEFAULT_FILTERS, activeOnly: true }, null)).toBe(false)
  })
  it('lọc kW: đúng mức thì qua, chưa có power thì ẩn', () => {
    expect(passesFilters(s, { ...DEFAULT_FILTERS, kw: ['mid'] }, pw)).toBe(true)
    expect(passesFilters(s, { ...DEFAULT_FILTERS, kw: ['hi'] }, pw)).toBe(false)
    expect(passesFilters(s, { ...DEFAULT_FILTERS, kw: ['mid'] }, null)).toBe(false)
    // Đủ 3 mức = không lọc → trạm chưa có power vẫn qua.
    expect(passesFilters(s, { ...DEFAULT_FILTERS, kw: ['hi', 'mid', 'low'] }, null)).toBe(true)
  })
})
