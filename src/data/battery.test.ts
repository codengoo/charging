import { describe, expect, it } from 'vitest'
import { arrivalPct, avgKmh, chargeMinutes, chargePort, speedFactor } from '@/data/battery'
import type { StationPower } from '@/data/types'
import { CUSTOM_ID, VEHICLES, vehicleOf, type Vehicle } from '@/data/vehicles'

const V: Vehicle = { id: 'test', name: 'Test', kwh: 100, kwhPer100: 20, dcKw: 150, acKw: 11 }

describe('speedFactor / avgKmh', () => {
  it('ngưỡng 40 / 70 / 90 km/h', () => {
    expect(speedFactor(30)).toBe(0.95)
    expect(speedFactor(40)).toBe(1)
    expect(speedFactor(69.9)).toBe(1)
    expect(speedFactor(70)).toBe(1.12)
    expect(speedFactor(90)).toBe(1.25)
  })
  it('avgKmh; thiếu thời gian → 50', () => {
    expect(avgKmh(120_000, 7200)).toBe(60)
    expect(avgKmh(120_000, 0)).toBe(50)
  })
})

describe('arrivalPct', () => {
  it('khoảng ±8% quanh mức tiêu thụ', () => {
    const r = arrivalPct(80, 100, 60, V, false)
    expect(r.low).toBeCloseTo(80 - 20 * 1.08, 9)
    expect(r.high).toBeCloseTo(80 - 20 * 0.92, 9)
  })
  it('điều hoà ×1,08 và cao tốc ×1,25', () => {
    const r = arrivalPct(80, 100, 100, V, true)
    const used = 20 * 1.25 * 1.08
    expect(r.low).toBeCloseTo(80 - used * 1.08, 9)
  })
  it('có thể âm (không tới được)', () => {
    expect(arrivalPct(10, 500, 60, V, false).high).toBeLessThan(0)
  })
})

describe('chargePort', () => {
  const p: StationPower = {
    portCount: 4,
    maxKw: 150,
    dcCount: 3,
    groups: [
      { kw: 150, count: 1, dc: true },
      { kw: 60, count: 2, dc: true },
      { kw: 11, count: 1, dc: false },
    ],
  }
  it('không live → nhóm DC mạnh nhất', () => {
    expect(chargePort(p, null)).toEqual({ kw: 150, dc: true })
  })
  it('live: cổng mạnh nhất còn trống; AC/DC tra theo nhóm', () => {
    expect(chargePort(p, [{ kw: 150, free: 0, total: 1 }, { kw: 60, free: 1, total: 2 }])).toEqual({ kw: 60, dc: true })
    expect(chargePort(p, [{ kw: 11, free: 1, total: 1 }])).toEqual({ kw: 11, dc: false })
  })
  it('live kW không có trong nhóm: > 22 kW là DC; không có gì → null', () => {
    expect(chargePort(undefined, [{ kw: 30, free: 1, total: 1 }])).toEqual({ kw: 30, dc: true })
    expect(chargePort(undefined, [{ kw: 22, free: 1, total: 1 }])).toEqual({ kw: 22, dc: false })
    expect(chargePort(undefined, null)).toBeNull()
  })
})

describe('chargeMinutes', () => {
  it('DC: 75% của min(cổng, xe)', () => {
    expect(chargeMinutes(20, { kw: 250, dc: true }, V)).toBeCloseTo((60 / 112.5) * 60, 9)
  })
  it('AC: 90% của min(cổng, bộ sạc xe)', () => {
    expect(chargeMinutes(20, { kw: 22, dc: false }, V, 30)).toBeCloseTo((10 / 9.9) * 60, 9)
  })
  it('đã đủ hoặc cổng 0 kW → null; fromPct âm tính từ 0', () => {
    expect(chargeMinutes(80, { kw: 150, dc: true }, V)).toBeNull()
    expect(chargeMinutes(10, { kw: 0, dc: true }, V)).toBeNull()
    expect(chargeMinutes(-5, { kw: 150, dc: true }, V, 10)).toBeCloseTo((10 / 112.5) * 60, 9)
  })
})

describe('vehicleOf', () => {
  it('mẫu có sẵn, override chỉ thay tiêu thụ', () => {
    expect(vehicleOf('vf8', 0, 0)).toBe(VEHICLES.find((v) => v.id === 'vf8'))
    expect(vehicleOf('vf8', 0, 0, 25)).toMatchObject({ id: 'vf8', kwh: 87.7, kwhPer100: 25, dcKw: 150 })
  })
  it('tuỳ chỉnh; id lạ / null → null', () => {
    expect(vehicleOf(CUSTOM_ID, 60, 16)).toEqual({ id: 'custom', name: 'Tuỳ chỉnh', kwh: 60, kwhPer100: 16, dcKw: 150, acKw: 11 })
    expect(vehicleOf('xyz', 60, 16)).toBeNull()
    expect(vehicleOf(null, 60, 16)).toBeNull()
  })
})
