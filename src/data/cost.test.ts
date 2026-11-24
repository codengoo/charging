import { describe, expect, it } from 'vitest'
import { CHARGE_EFFICIENCY, billedKwh, chargeCost, fmtVnd, tripCosts } from '@/data/cost'

const car = { kwh: 60 }

describe('billedKwh', () => {
  it('kWh vào pin chia hiệu suất sạc', () => {
    // 20 → 80% của 60 kWh = 36 kWh vào pin.
    expect(billedKwh(20, 80, car)).toBeCloseTo(36 / CHARGE_EFFICIENCY, 6)
  })
  it('đã đủ / vượt mức → 0; % âm coi như 0', () => {
    expect(billedKwh(85, 80, car)).toBe(0)
    expect(billedKwh(-10, 50, car)).toBeCloseTo(30 / CHARGE_EFFICIENCY, 6)
  })
})

describe('chargeCost', () => {
  it('nhân giá', () => {
    expect(chargeCost(20, 80, car, 4000)).toBeCloseTo((36 / CHARGE_EFFICIENCY) * 4000, 3)
  })
  it('giá 0 (miễn phí) → null', () => {
    expect(chargeCost(20, 80, car, 0)).toBeNull()
  })
})

describe('tripCosts', () => {
  const o = { pricePerKwh: 4000, fuelPer100: 7, fuelPrice: 20000 }
  it('điện: kWh ÷ hiệu suất × giá; xăng: km × L/100 × giá', () => {
    const r = tripCosts(30, 200, o)
    expect(r.ev).toBeCloseTo((30 / CHARGE_EFFICIENCY) * 4000, 3)
    expect(r.fuel).toBeCloseTo(14 * 20000, 6)
  })
  it('giá 0 → null', () => {
    expect(tripCosts(30, 200, { ...o, pricePerKwh: 0 }).ev).toBeNull()
    expect(tripCosts(30, 200, { ...o, fuelPrice: 0 }).fuel).toBeNull()
  })
})

describe('fmtVnd', () => {
  it('làm tròn tới 1.000 đ, dấu chấm hàng nghìn', () => {
    expect(fmtVnd(150_986)).toBe('~151.000 đ')
    expect(fmtVnd(1_499)).toBe('~1.000 đ')
  })
  it('dưới 1.000 đ làm tròn tới 100 đ, tối thiểu 100 đ', () => {
    expect(fmtVnd(640)).toBe('~600 đ')
    expect(fmtVnd(10)).toBe('~100 đ')
  })
})
