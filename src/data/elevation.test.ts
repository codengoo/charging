import { describe, expect, it } from 'vitest'
import { climbKwh, elevationProfile } from '@/data/elevation'
import type { GeoPoint } from '@/lib/geo'

/** Tuyến thẳng theo kinh tuyến, mỗi điểm cách ~1,1 km. */
const line = (n: number): GeoPoint[] => Array.from({ length: n }, (_, i) => ({ lat: 11 + i * 0.01, lng: 108 }))

describe('elevationProfile', () => {
  it('thiếu / lệch độ dài độ cao → null', () => {
    expect(elevationProfile(line(3), undefined)).toBeNull()
    expect(elevationProfile(line(3), [0, 1])).toBeNull()
  })
  it('cộng leo / xuống, bỏ nhiễu nhỏ hơn ngưỡng', () => {
    // Nhấp nhô ±2 m quanh 100 m (nhiễu) rồi leo lên 300, xuống 50.
    const p = elevationProfile(line(7), [100, 102, 99, 101, 300, 300, 50])!
    expect(p.totalUp).toBeCloseTo(200, 6)
    expect(p.totalDown).toBeCloseTo(250, 6)
    expect(p.km[6]).toBeGreaterThan(6)
  })
})

describe('climbKwh', () => {
  const p = elevationProfile(line(3), [0, 1000, 1000])!
  const kmEnd = p.km[2]
  it('leo 1000 m với xe 2 tấn ≈ m·g·h ÷ 0,85', () => {
    expect(climbKwh(p, 0, kmEnd, 2000)).toBeCloseTo((2000 * 9.81 * 1000) / 0.85 / 3.6e6, 3)
  })
  it('đổ dốc → âm (lấy lại một phần), ít hơn phần đã tốn khi leo', () => {
    const down = elevationProfile(line(3), [1000, 0, 0])!
    const back = climbKwh(down, 0, down.km[2], 2000)
    expect(back).toBeLessThan(0)
    expect(-back).toBeLessThan(climbKwh(p, 0, kmEnd, 2000))
  })
  it('đoạn giữa tuyến nội suy; đảo chiều from/to cho cùng kết quả', () => {
    const half = climbKwh(p, 0, p.km[1] / 2, 2000)
    expect(half).toBeCloseTo(climbKwh(p, 0, kmEnd, 2000) / 2, 3)
    expect(climbKwh(p, kmEnd, 0, 2000)).toBeCloseTo(climbKwh(p, 0, kmEnd, 2000), 9)
  })
  it('đoạn bằng phẳng → 0', () => {
    expect(climbKwh(p, p.km[1], kmEnd, 2000)).toBeCloseTo(0, 9)
  })
})
