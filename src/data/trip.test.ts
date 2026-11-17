import { describe, expect, it } from 'vitest'
import { limitedFlags, parseHereRoutes, waypointsOf } from '@/data/trip'
import { decodeFlexiblePolyline } from '@/lib/flexiblePolyline'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
/** Bộ mã hoá flexible polyline tối giản (2D, precision 5) — chỉ để dựng body HERE giả. */
function encode(points: Array<[number, number]>): string {
  const varint = (v: number) => {
    let s = ''
    while (v > 0x1f) {
      s += ALPHABET[(v & 0x1f) | 0x20]
      v = Math.floor(v / 32)
    }
    return s + ALPHABET[v]
  }
  const zz = (v: number) => (v < 0 ? -2 * v - 1 : 2 * v)
  let out = varint(1) + varint(5)
  let pLat = 0
  let pLng = 0
  for (const [lat, lng] of points) {
    const a = Math.round(lat * 1e5)
    const b = Math.round(lng * 1e5)
    out += varint(zz(a - pLat)) + varint(zz(b - pLng))
    pLat = a
    pLng = b
  }
  return out
}

describe('encode (helper)', () => {
  it('khớp vector mẫu của HERE', () => {
    expect(
      encode([
        [50.10228, 8.69821],
        [50.10201, 8.69567],
        [50.10063, 8.6915],
        [50.09878, 8.68752],
      ]),
    ).toBe('BFoz5xJ67i1B1B7PzIhaxL7Y')
  })
})

describe('limitedFlags', () => {
  it('không có spans → toàn false', () => {
    expect(limitedFlags(undefined, 3)).toEqual([false, false, false])
  })
  it('span functionalClass 1 kéo tới offset của span kế tiếp', () => {
    const spans = [
      { offset: 0, functionalClass: 3 },
      { offset: 2, functionalClass: 1 },
      { offset: 4, functionalClass: 2 },
    ]
    expect(limitedFlags(spans, 6)).toEqual([false, false, true, true, false, false])
  })
  it('span cao tốc cuối kéo tới hết; offset ngoài khoảng bị kẹp', () => {
    expect(limitedFlags([{ offset: 3, functionalClass: 1 }], 5)).toEqual([false, false, false, true, true])
    expect(limitedFlags([{ offset: -2, functionalClass: 1 }, { offset: 99, functionalClass: 2 }], 3)).toEqual([
      true,
      true,
      true,
    ])
  })
})

describe('waypointsOf', () => {
  it('xen điểm kéo (pass) giữa các chặng, bỏ via sau chặng cuối', () => {
    const stops = [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 3 }]
    const vias = [[{ lat: 1.5, lng: 1.5 }], [], [{ lat: 9, lng: 9 }]]
    expect(waypointsOf(stops, vias)).toEqual([
      { lat: 1, lng: 1 },
      { lat: 1.5, lng: 1.5, pass: true },
      { lat: 2, lng: 2 },
      { lat: 3, lng: 3 },
    ])
  })
  it('vias thiếu phần tử vẫn chạy', () => {
    expect(waypointsOf([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }], [])).toHaveLength(2)
  })
  it('không chép thuộc tính thừa', () => {
    const stops = [{ lat: 1, lng: 1, label: 'x' } as { lat: number; lng: number }]
    expect(waypointsOf(stops, [[]])).toEqual([{ lat: 1, lng: 1 }])
  })
})

describe('parseHereRoutes', () => {
  const s1 = encode([
    [21.0, 105.8],
    [21.01, 105.81],
    [21.02, 105.82],
  ])
  const s2 = encode([
    [21.02, 105.82],
    [21.03, 105.83],
  ])
  it('nối section, bỏ điểm nối trùng kèm cờ của nó, cộng length/duration', () => {
    const [r] = parseHereRoutes({
      routes: [
        {
          sections: [
            { polyline: s1, summary: { length: 3000, duration: 200 }, spans: [{ offset: 0, functionalClass: 1 }] },
            { polyline: s2, summary: { length: 1500, duration: 100 }, spans: [{ offset: 0, functionalClass: 4 }] },
          ],
        },
      ],
    })
    expect(r.points.map((p) => [p.lat, p.lng])).toEqual([
      [21.0, 105.8],
      [21.01, 105.81],
      [21.02, 105.82],
      [21.03, 105.83],
    ])
    expect(r.limited).toEqual([true, true, true, false])
    expect(r.meters).toBe(4500)
    expect(r.seconds).toBe(300)
  })
  it('nhiều tuyến; tuyến < 2 điểm bị bỏ', () => {
    const routes = parseHereRoutes({
      routes: [{ sections: [{ polyline: s1 }] }, { sections: [{ polyline: encode([[21, 105]]) }] }, { sections: [] }],
    })
    expect(routes).toHaveLength(1)
    expect(routes[0].meters).toBe(0)
    expect(routes[0].limited).toEqual([false, false, false])
  })
  it('body rỗng → []', () => {
    expect(parseHereRoutes({})).toEqual([])
    expect(decodeFlexiblePolyline(s2)).toHaveLength(2)
  })
})
