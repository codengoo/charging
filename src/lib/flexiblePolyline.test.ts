import { describe, expect, it } from 'vitest'
import { decodeFlexiblePolyline, type GeoPoint } from '@/lib/flexiblePolyline'

const near = (got: GeoPoint[], want: Array<[number, number]>) => {
  expect(got).toHaveLength(want.length)
  got.forEach((p, i) => {
    expect(p.lat).toBeCloseTo(want[i][0], 9)
    expect(p.lng).toBeCloseTo(want[i][1], 9)
  })
}

// Vector mẫu trong README của heremaps/flexible-polyline.
const HERE_2D: Array<[number, number]> = [
  [50.10228, 8.69821],
  [50.10201, 8.69567],
  [50.10063, 8.6915],
  [50.09878, 8.68752],
]

describe('decodeFlexiblePolyline', () => {
  it('vector 2D chính thức của HERE (precision 5)', () => {
    near(decodeFlexiblePolyline('BFoz5xJ67i1B1B7PzIhaxL7Y'), HERE_2D)
  })
  it('vector 3D chính thức (độ cao, precision 5/0): đọc bỏ chiều thứ ba, không lệch nhịp', () => {
    near(decodeFlexiblePolyline('BlBoz5xJ67i1BU1B7PUzIhaUxL7YU'), HERE_2D)
  })
  it('chuỗi rỗng hoặc sai phiên bản → []', () => {
    expect(decodeFlexiblePolyline('')).toEqual([])
    // 'C' = 2 → phiên bản 2
    expect(decodeFlexiblePolyline('CFoz5xJ67i1B1B7PzIhaxL7Y')).toEqual([])
  })
  it('ký tự lạ giữa chừng → dừng, giữ các điểm đã đọc', () => {
    const pts = decodeFlexiblePolyline('BFoz5xJ67i1B1B7P*zIhaxL7Y')
    near(pts, HERE_2D.slice(0, 2))
  })
  it('cụt giữa một điểm (thiếu kinh độ) → bỏ điểm đó', () => {
    near(decodeFlexiblePolyline('BFoz5xJ67i1B1B'), HERE_2D.slice(0, 1))
  })
})
