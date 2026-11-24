import { describe, expect, it } from 'vitest'
import { driveInfoOf } from '@/data/drive'

describe('driveInfoOf', () => {
  it('không có tuyến / quãng 0 → null', () => {
    expect(driveInfoOf({})).toBeNull()
    expect(driveInfoOf({ routes: [{ sections: [{ summary: { length: 0, duration: 0 } }] }] })).toBeNull()
  })
  it('chỉ summary (Worker cũ) → không có độ cao', () => {
    expect(driveInfoOf({ routes: [{ sections: [{ summary: { length: 5000, duration: 600 } }] }] })).toEqual({ meters: 5000, seconds: 600 })
  })
  it('polyline 3D → tổng leo / xuống', () => {
    // Vector 3D chính thức của HERE: độ cao 10 → 20 → 30 → 40 m.
    const r = driveInfoOf({
      routes: [{ sections: [{ polyline: 'BlBoz5xJ67i1BU1B7PUzIhaUxL7YU', summary: { length: 1000, duration: 60 } }] }],
    })
    expect(r).toEqual({ meters: 1000, seconds: 60, upM: 30, downM: 0 })
  })
})
