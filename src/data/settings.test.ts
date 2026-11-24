import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, filtersFrom, parseCar, parseSettings, swapCar } from '@/data/settings'

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
      fuelPer100: 8.5,
      fuelPrice: 24000,
      batteryHealth: 90,
      driveStyle: 'eco',
      carSlot: 1,
      otherCar: null,
    })
    expect(s).toEqual({
      batteryHealth: 90,
      driveStyle: 'eco',
      carSlot: 1,
      otherCar: null,
      fuelPer100: 8.5,
      fuelPrice: 24000,
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

describe('batteryHealth / driveStyle', () => {
  it('ngoài khoảng / không nguyên / lạ → mặc định', () => {
    expect(parse({ batteryHealth: 59 }).batteryHealth).toBe(100)
    expect(parse({ batteryHealth: 92.5 }).batteryHealth).toBe(100)
    expect(parse({ batteryHealth: 85 }).batteryHealth).toBe(85)
    expect(parse({ driveStyle: 'sport' }).driveStyle).toBe('normal')
  })
})

describe('hồ sơ 2 xe', () => {
  it('parseCar: không phải object → null; trường sai → mặc định', () => {
    expect(parseCar(null)).toBeNull()
    expect(parseCar('x')).toBeNull()
    expect(parseCar({ vehicleId: 'tesla', batteryHealth: 10, battery: { pct: 200, at: 1 } })).toEqual({
      vehicleId: null,
      customKwh: DEFAULT_SETTINGS.customKwh,
      customKwhPer100: DEFAULT_SETTINGS.customKwhPer100,
      usageOverride: null,
      batteryHealth: 100,
      battery: null,
    })
  })
  it('swapCar: lần đầu → xe 2 trống, xe 1 cất kèm % pin; đổi lại thì về như cũ', () => {
    const s1 = { ...DEFAULT_SETTINGS, vehicleId: 'vf8', batteryHealth: 90 }
    const b1 = { pct: 55, at: 1000 }
    const a = swapCar(s1, b1)
    expect(a.patch.carSlot).toBe(1)
    expect(a.patch.vehicleId).toBeNull()
    expect(a.battery).toBeNull()
    expect(a.patch.otherCar).toMatchObject({ vehicleId: 'vf8', batteryHealth: 90, battery: b1 })
    const s2 = { ...s1, ...a.patch, vehicleId: 'vf3' }
    const b = swapCar(s2, { pct: 30, at: 2000 })
    expect(b.patch).toMatchObject({ carSlot: 0, vehicleId: 'vf8', batteryHealth: 90 })
    expect(b.battery).toEqual(b1)
    expect(b.patch.otherCar).toMatchObject({ vehicleId: 'vf3', battery: { pct: 30, at: 2000 } })
  })
  it('otherCar đi qua parseSettings', () => {
    const s = parse({ otherCar: { vehicleId: 'vf5', customKwh: 60, customKwhPer100: 16, usageOverride: null, batteryHealth: 95, battery: null } })
    expect(s.otherCar?.vehicleId).toBe('vf5')
  })
})
