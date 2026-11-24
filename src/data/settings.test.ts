import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, filtersFrom, parseSettings } from '@/data/settings'

const parse = (o: unknown) => parseSettings(JSON.stringify(o))

describe('parseSettings', () => {
  it('null / JSON hỏng / không phải object → mặc định', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('{bad')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS)
  })
  it('đọc đúng các trường hợp lệ', () => {
    const s = parse({
      kwBands: ['hi'],
      activeOnly: true,
      tripRadiusKm: 5,
      showLegend: false,
      theme: 'dark',
      vehicleId: 'vf8',
      customKwh: 80,
      customKwhPer100: 18,
      usageOverride: 21.5,
      climate: false,
      reservePct: 15,
      publicOnly: true,
      freeParking: true,
      minPorts: 4,
      pricePerKwh: 0,
    })
    expect(s).toEqual({
      publicOnly: true,
      freeParking: true,
      minPorts: 4,
      pricePerKwh: 0,
      kwBands: ['hi'],
      activeOnly: true,
      tripRadiusKm: 5,
      showLegend: false,
      theme: 'dark',
      vehicleId: 'vf8',
      customKwh: 80,
      customKwhPer100: 18,
      usageOverride: 21.5,
      climate: false,
      reservePct: 15,
    })
  })
  it('chuyển bản cũ `power` sang kwBands', () => {
    expect(parse({ power: 'dc120' }).kwBands).toEqual(['hi'])
    expect(parse({ power: 'dc' }).kwBands).toEqual(['hi', 'mid'])
    expect(parse({ power: 'all' }).kwBands).toEqual(['hi', 'mid', 'low'])
    // kwBands có rồi thì bỏ qua power.
    expect(parse({ power: 'dc120', kwBands: ['low'] }).kwBands).toEqual(['low'])
  })
  it('kwBands: bỏ mức lạ, giữ thứ tự chuẩn; rỗng sau lọc → đủ 3 mức', () => {
    expect(parse({ kwBands: ['low', 'xx', 'hi'] }).kwBands).toEqual(['hi', 'low'])
    expect(parse({ kwBands: ['xx'] }).kwBands).toEqual(['hi', 'mid', 'low'])
    expect(parse({ kwBands: [] }).kwBands).toEqual(['hi', 'mid', 'low'])
  })
  it('sai kiểu / ngoài khoảng → mặc định từng trường', () => {
    const s = parse({
      activeOnly: 'yes',
      tripRadiusKm: 3,
      theme: 'blue',
      vehicleId: 'tesla',
      customKwh: 1000,
      customKwhPer100: 4,
      usageOverride: 'x',
      reservePct: 12.5,
      publicOnly: 1,
      minPorts: 3,
      pricePerKwh: -5,
    })
    expect(s).toEqual(DEFAULT_SETTINGS)
  })
  it('reservePct: số nguyên trong 1..50', () => {
    expect(parse({ reservePct: 1 }).reservePct).toBe(1)
    expect(parse({ reservePct: 50 }).reservePct).toBe(50)
    expect(parse({ reservePct: 0 }).reservePct).toBe(DEFAULT_SETTINGS.reservePct)
    expect(parse({ reservePct: 51 }).reservePct).toBe(DEFAULT_SETTINGS.reservePct)
  })
  it('vehicleId "custom" hợp lệ', () => {
    expect(parse({ vehicleId: 'custom' }).vehicleId).toBe('custom')
  })
})

describe('filtersFrom', () => {
  it('lấy kW + activeOnly + lọc thêm, favoritesOnly luôn tắt', () => {
    const s = parse({ kwBands: ['mid'], activeOnly: true, freeParking: true, minPorts: 2 })
    expect(filtersFrom(s)).toEqual({
      favoritesOnly: false,
      activeOnly: true,
      kw: ['mid'],
      publicOnly: false,
      freeParking: true,
      minPorts: 2,
    })
  })
})
