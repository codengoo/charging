import { describe, expect, it } from 'vitest'
import { EXIT_ACCESS_KM, PLAN_MIN_DC_KW, passByKm, planCharging } from '@/data/chargePlan'
import type { AlongRoute } from '@/data/routeCorridor'
import type { PortGroup, Station, StationPower } from '@/data/types'
import type { Vehicle } from '@/data/vehicles'

/**
 * Xe dễ tính: 100 kWh, 20 kWh/100 km, nhận DC 150 kW. Tốc độ trung bình 60 km/h (hệ số 1),
 * không điều hoà → mỗi km tốn 0,2%; ước tính bi quan ×1,08 = 0,216%/km.
 * Từ 80% đi được tới ~324 km mà vẫn còn ≥ 10% (bi quan).
 */
const V: Vehicle = { id: 'test', name: 'Test', kwh: 100, kwhPer100: 20, dcKw: 150, acKw: 11, massKg: 2000 }
const RESERVE = 10
const route = (km: number) => ({ meters: km * 1000, seconds: km * 60 }) // 60 km/h

function item(id: string, atKm: number, opts: { offsetKm?: number; viaExit?: boolean } = {}): AlongRoute {
  const station = { entityId: id, name: id } as Station
  return { station, atKm, offsetKm: opts.offsetKm ?? 0, viaExit: opts.viaExit ?? false }
}
const dc = (kw: number): PortGroup[] => [{ kw, count: 2, dc: true }]
function powerOf(entries: Array<[string, PortGroup[]]>): Map<string, StationPower> {
  return new Map(entries.map(([id, groups]) => [id, { portCount: 2, maxKw: groups[0].kw, dcCount: 2, groups }]))
}
/** Trạm DC 150 kW mỗi 100 km. */
const every100 = (maxKm: number) => {
  const items: AlongRoute[] = []
  for (let km = 100; km < maxKm; km += 100) items.push(item(`s${km}`, km))
  return { items, power: powerOf(items.map((i) => [i.station.entityId, dc(150)])) }
}

describe('planCharging', () => {
  it('độ dốc: leo làm tới nơi ít pin hơn, đủ dốc thì phải dừng sạc', () => {
    const { items, power } = every100(300)
    const flat = planCharging(items, power, route(300), 80, V, false, RESERVE)
    // Đường bằng: tới nơi còn 80 − 0,216 × 300 ≈ 15% (bi quan). Leo thêm 0,05 kWh/km = 15 kWh
    // (15% pin với xe 100 kWh) cả tuyến → dưới mức dự phòng 10%, phải dừng sạc.
    const uphill = (a: number, b: number) => (b - a) * 0.05
    const hilly = planCharging(items, power, route(300), 80, V, false, RESERVE, uphill)
    expect(flat.ok && hilly.ok).toBe(true)
    if (!flat.ok || !hilly.ok) return
    expect(flat.stops).toEqual([])
    expect(hilly.stops.length).toBeGreaterThan(0)
  })
  it('tới đích không cần dừng', () => {
    const { items, power } = every100(300)
    const p = planCharging(items, power, route(300), 80, V, false, RESERVE)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.stops).toEqual([])
    expect(p.arriveDest.low).toBeCloseTo(80 - 0.216 * 300, 6)
    expect(p.arriveDest.high).toBeCloseTo(80 - 0.184 * 300, 6)
    expect(p.chargeMin).toBe(0)
    expect(p.totalSeconds).toBe(18_000)
  })

  it('một điểm dừng: ghé trạm XA NHẤT tới được, sạc vừa đủ tới đích', () => {
    const { items, power } = every100(500)
    const p = planCharging(items, power, route(500), 80, V, false, RESERVE)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.stops).toHaveLength(1)
    const [s] = p.stops
    expect(s.item.atKm).toBe(300)
    expect(s.kw).toBe(150)
    expect(s.arrive.low).toBeCloseTo(15.2, 6)
    // 200 km còn lại tốn 43,2% (bi quan) → ceil(10 + 43,2) = 54%.
    expect(s.toPct).toBe(54)
    // Từ giữa khoảng (20%) lên 54% = 34 kWh ở 150 × 0,75 kW.
    expect(s.chargeMin).toBeCloseTo((34 / 112.5) * 60, 6)
    expect(p.arriveDest.low).toBeCloseTo(54 - 43.2, 6)
    expect(p.totalSeconds).toBeCloseTo(30_000 + (34 / 112.5) * 3600, 6)
  })

  it('hai điểm dừng: chia mức sạc giữa hai trạm sao cho tổng thời gian ít nhất; điểm cuối vừa đủ', () => {
    const { items, power } = every100(700)
    const p = planCharging(items, power, route(700), 80, V, false, RESERVE)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.stops.map((s) => s.item.atKm)).toEqual([300, 600])
    expect(p.stops[0].toPct).toBeLessThanOrEqual(80)
    expect(p.stops[1].toPct).toBe(32)
    // Công suất phẳng → tổng thời gian = tổng điện nạp, không phụ thuộc chia ở trạm nào (60% + 12%).
    expect(p.chargeMin).toBeCloseTo((60 / 112.5) * 60 + (12 / 112.5) * 60, 6)
  })

  it('ít lần sạc thắng: một lần dừng ở trạm chậm hơn hai lần dừng ở trạm nhanh', () => {
    // 600 km từ 80%: trạm 60 kW ở km 300 đủ một lần dừng; trạm 150 kW ở km 200 / 400 thì mỗi trạm
    // một mình không đủ (200 → đích cần 96%; 400 không tới được từ đầu) → phải dừng cả hai.
    const items = [item('f200', 200), item('slow300', 300), item('f400', 400)]
    const power = powerOf([['f200', dc(150)], ['slow300', dc(60)], ['f400', dc(150)]])
    const p = planCharging(items, power, route(600), 80, V, false, RESERVE)
    expect(p.stops.map((s) => s.item.station.entityId)).toEqual(['slow300'])
  })

  it('cùng số lần sạc: trạm sạc nhanh hơn thắng dù gần hơn', () => {
    // Một lần dừng là đủ ở cả km 200 (150 kW) lẫn km 300 (50 kW): trạm 150 kW sạc nhanh hơn hẳn.
    const items = [item('fast200', 200), item('slow300', 300)]
    const power = powerOf([['fast200', dc(150)], ['slow300', dc(50)]])
    const p = planCharging(items, power, route(500), 80, V, false, RESERVE)
    expect(p.stops.map((s) => s.item.station.entityId)).toEqual(['fast200'])
  })

  it('kẹt: không trạm nào tới được → ok:false, stuckAtKm = chỗ đang đứng', () => {
    const items = [item('a', 100), item('b', 500)]
    const power = powerOf([['a', dc(150)], ['b', dc(150)]])
    const p = planCharging(items, power, route(700), 80, V, false, RESERVE)
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.stuckAtKm).toBe(100)
    expect(p.stops.map((s) => s.item.station.entityId)).toEqual(['a'])
  })

  it('không có dữ liệu power → kẹt ngay từ km 0', () => {
    const { items } = every100(500)
    const p = planCharging(items, null, route(500), 80, V, false, RESERVE)
    expect(p).toEqual({ ok: false, stops: [], stuckAtKm: 0 })
  })

  it('ưu tiên trạm vào thẳng: trạm viaExit xa hơn vẫn không được chọn khi còn trạm vào thẳng', () => {
    const items = [item('s200', 200), item('s300', 300, { viaExit: true })]
    const power = powerOf([['s200', dc(150)], ['s300', dc(150)]])
    const p = planCharging(items, power, route(500), 80, V, false, RESERVE)
    expect(p.stops.map((s) => s.item.station.entityId)).toEqual(['s200'])
  })

  it('chặng không còn trạm vào thẳng → dùng trạm viaExit, cộng quãng vòng ước tính', () => {
    // Chỉ có trạm phải ra cao tốc ở km 300, lệch 1 km: vào trạm = 300 + 1 + EXIT_ACCESS_KM.
    const items = [item('x300', 300, { offsetKm: 1, viaExit: true })]
    const power = powerOf([['x300', dc(150)]])
    const p = planCharging(items, power, route(500), 80, V, false, RESERVE)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.stops.map((s) => s.item.station.entityId)).toEqual(['x300'])
    const access = 1 + EXIT_ACCESS_KM
    expect(p.stops[0].detourKm).toBeCloseTo(2 * access, 6)
    expect(p.stops[0].arrive.low).toBeCloseTo(80 - 0.216 * (300 + access), 6)
    // Thời gian lái thêm vì vòng (60 km/h → 1 phút/km) cộng vào tổng.
    expect(p.totalSeconds).toBeCloseTo(500 * 60 + 2 * access * 60 + p.chargeMin * 60, 6)
  })

  it('quãng vòng ra cao tốc có thể làm trạm không còn tới được', () => {
    // Trạm vào thẳng ở km 322 tới được (còn 10,4%); cùng vị trí nhưng phải ra cao tốc thì
    // 322 + 2,5 = 324,5 km → bi quan 9,9% < 10% → kẹt.
    const at = 322
    const ok = planCharging([item('d', at)], powerOf([['d', dc(150)]]), route(500), 80, V, false, RESERVE)
    expect(ok.stops.map((s) => s.item.station.entityId)).toEqual(['d'])
    const stuck = planCharging([item('x', at, { viaExit: true })], powerOf([['x', dc(150)]]), route(500), 80, V, false, RESERVE)
    expect(stuck).toEqual({ ok: false, stops: [], stuckAtKm: 0 })
  })

  it(`bỏ trạm DC dưới ${PLAN_MIN_DC_KW} kW và trạm chỉ có AC`, () => {
    const items = [item('s200', 200), item('slow', 290), item('ac', 300)]
    const power = powerOf([
      ['s200', dc(60)],
      ['slow', dc(30)],
      ['ac', [{ kw: 60, count: 2, dc: false }]],
    ])
    const p = planCharging(items, power, route(500), 80, V, false, RESERVE)
    expect(p.stops.map((s) => [s.item.station.entityId, s.kw])).toEqual([['s200', 60]])
  })

  it('độ lệch tính cả lúc rẽ vào lẫn lúc quay ra', () => {
    // Trạm ở km 320 lệch 5 km: tới nơi = 325 km → bi quan còn 9,8% < 10% → không chọn.
    const items = [item('s200', 200), item('s320', 320, { offsetKm: 5 })]
    const power = powerOf([['s200', dc(150)], ['s320', dc(150)]])
    const p = planCharging(items, power, route(500), 80, V, false, RESERVE)
    expect(p.stops.map((s) => s.item.station.entityId)).toEqual(['s200'])
  })
})

describe('passByKm', () => {
  it('rẽ vào rồi quay ra tuyến: atKm + 2 × accessKm', () => {
    expect(passByKm({ atKm: 120, offsetKm: 1.5, viaExit: false })).toBe(123)
    expect(passByKm({ atKm: 0, offsetKm: 0, viaExit: false })).toBe(0)
    // Phải ra cao tốc: mỗi chiều cộng thêm quãng ra nút giao.
    expect(passByKm({ atKm: 50, offsetKm: 0.2, viaExit: true })).toBeCloseTo(50 + 2 * (0.2 + EXIT_ACCESS_KM))
  })
})
