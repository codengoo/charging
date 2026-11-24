import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, MAX_CARS, addCar, allCars, filtersFrom, parseCar, parseSettings, removeCar, switchCar, type CarChange, type Settings } from '@/data/settings'

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
      carId: 2,
      garage: [],
    })
    expect(s).toEqual({
      batteryHealth: 90,
      driveStyle: 'eco',
      carId: 2,
      garage: [],
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

describe('nhiều xe', () => {
  const b1 = { pct: 55, at: 1000 }
  const one: Settings = { ...DEFAULT_SETTINGS, vehicleId: 'vf8', batteryHealth: 90 }
  const apply = (s: Settings, c: CarChange | null): Settings => ({ ...s, ...c!.patch })

  it('parseCar: không phải object → null; trường sai → mặc định', () => {
    expect(parseCar(null)).toBeNull()
    expect(parseCar({ id: 0, vehicleId: 'tesla', batteryHealth: 10, battery: { pct: 200, at: 1 } })).toEqual({
      id: 1,
      vehicleId: null,
      customKwh: DEFAULT_SETTINGS.customKwh,
      customKwhPer100: DEFAULT_SETTINGS.customKwhPer100,
      usageOverride: null,
      batteryHealth: 100,
      battery: null,
    })
  })
  it('thêm xe: xe mới trống, xe cũ cất kèm % pin; chọn lại thì về như cũ', () => {
    const add = addCar(one, b1)!
    expect(add.patch).toMatchObject({ carId: 2, vehicleId: null, batteryHealth: 100 })
    expect(add.battery).toBeNull()
    const two = apply(one, add)
    expect(two.garage).toEqual([expect.objectContaining({ id: 1, vehicleId: 'vf8', batteryHealth: 90, battery: b1 })])
    const back = switchCar({ ...two, vehicleId: 'vf3' }, { pct: 30, at: 2000 }, 1)!
    expect(back.patch).toMatchObject({ carId: 1, vehicleId: 'vf8', batteryHealth: 90 })
    expect(back.battery).toEqual(b1)
    expect(back.patch.garage).toEqual([expect.objectContaining({ id: 2, vehicleId: 'vf3', battery: { pct: 30, at: 2000 } })])
  })
  it('allCars theo số hiệu; chọn xe không có / đang dùng → null', () => {
    const two = apply(one, addCar(one, b1))
    expect(allCars(two).map((c) => c.id)).toEqual([1, 2])
    expect(switchCar(two, null, 2)).toBeNull()
    expect(switchCar(two, null, 9)).toBeNull()
  })
  it(`tối đa ${MAX_CARS} xe`, () => {
    let s = one
    for (let i = 1; i < MAX_CARS; i++) s = apply(s, addCar(s, null))
    expect(allCars(s)).toHaveLength(MAX_CARS)
    expect(addCar(s, null)).toBeNull()
  })
  it('xoá: xe cất → bỏ khỏi garage; xe đang dùng → chuyển sang số nhỏ nhất; chỉ còn 1 xe → về trống', () => {
    let s = apply(one, addCar(one, b1)) // đang dùng xe 2, xe 1 cất
    s = apply(s, addCar(s, null)) // đang dùng xe 3
    expect(apply(s, removeCar(s, null, 2)).garage.map((c) => c.id)).toEqual([1])
    const r = removeCar(s, null, 3)
    expect(r.patch).toMatchObject({ carId: 1, vehicleId: 'vf8' })
    expect(r.battery).toEqual(b1)
    const last = removeCar(one, b1, 1)
    expect(last.patch).toMatchObject({ vehicleId: null, batteryHealth: 100 })
    expect(last.battery).toBeNull()
  })
  it('chuyển dữ liệu 0.18.0 (carSlot + otherCar) sang garage', () => {
    const other = { vehicleId: 'vf5', customKwh: 60, customKwhPer100: 16, usageOverride: null, batteryHealth: 95, battery: null }
    const a = parse({ carSlot: 1, otherCar: other })
    expect(a.carId).toBe(2)
    expect(a.garage).toEqual([expect.objectContaining({ id: 1, vehicleId: 'vf5' })])
    expect(parse({ carSlot: 0, otherCar: other }).garage[0].id).toBe(2)
  })
  it('garage: id trùng với xe đang dùng thì đánh lại', () => {
    const g = parse({ carId: 1, garage: [{ id: 1, vehicleId: 'vf5' }, { id: 3, vehicleId: 'vf6' }] }).garage
    expect(g.map((c) => c.id)).toEqual([2, 3])
  })
})
