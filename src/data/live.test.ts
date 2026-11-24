import { describe, expect, it } from 'vitest'
import { analyseHistory, estimateFromHistory, freeSummary, parseLive, windowHistory, type HistoryPoint, type LiveHistory } from '@/data/live'

const M = 60_000
const H = 60 * M
/** 03:00 UTC = 10:00 giờ Việt Nam. */
const T0 = Date.UTC(2026, 10, 17, 3, 0)

describe('parseLive', () => {
  it('đọc pill "✧ 60kW trống 7/10 cổng", sắp kW giảm dần, bỏ kW trùng', () => {
    const r = parseLive(
      {
        ports: '✧ 60kW trống 7/10 cổng<br>✧ 150 kW trống 1 / 2 cổng ✧ 60kW trống 0/10 cổng ✧ 11.5kW trống 2/4',
        charging: 5,
        maintPorts: 1,
        depotMaint: false,
      },
      123,
    )
    expect(r.ports).toEqual([
      { kw: 150, free: 1, total: 2 },
      { kw: 60, free: 7, total: 10 },
      { kw: 11.5, free: 2, total: 4 },
    ])
    expect(r).toMatchObject({ charging: 5, maintPorts: 1, maintenance: false, at: 123 })
  })
  it('ticker dự kiến xong: khoảng a–b phút hoặc một số', () => {
    const r = parseLive({
      ticker:
        'Dự kiến <b>15</b> xe sạc trụ <b>120kW</b> sẽ xong trong <b>1-27</b> phút nữa · ' +
        'Dự kiến <b> 2 </b> xe sạc trụ <b>60 kW</b> sẽ xong trong <b>5</b> phut nữa',
    })
    expect(r.forecast).toEqual([
      { cars: 15, kw: 120, minMinutes: 1, maxMinutes: 27 },
      { cars: 2, kw: 60, minMinutes: 5, maxMinutes: 5 },
    ])
  })
  it('body rỗng → mặc định', () => {
    expect(parseLive({}, 1)).toEqual({ ports: [], charging: 0, maintPorts: 0, maintenance: false, forecast: [], at: 1 })
    expect(parseLive({ depotMaint: true }, 1).maintenance).toBe(true)
  })
})

describe('analyseHistory', () => {
  it('trung bình theo THỜI GIAN, giờ cao/thấp điểm theo giờ VN', () => {
    const p: HistoryPoint[] = [
      { at: T0, cars: 2 },
      { at: T0 + H, cars: 4 },
      { at: T0 + 2 * H, cars: 0 },
    ]
    const s = analyseHistory(p, 6)!
    expect(s.avg).toBe(3)
    expect(s.peak).toBe(4)
    expect(s.peakHour).toBe(11)
    expect(s.quietHour).toBe(10)
    expect(s.fillRate).toBe(0.5)
    expect(s.coverage).toBe(1)
    expect(s.deadMinutes).toBe(0)
    expect(s.byHour[10]).toEqual({ hour: 10, avg: 2, thin: false })
    expect(s.byHour[0]).toEqual({ hour: 0, avg: null, thin: true })
  })
  it('đoạn 0 xe ≥ 20 phút ngay sau lúc đông (≥ 3 xe) = mất dữ liệu', () => {
    const p: HistoryPoint[] = [
      { at: T0, cars: 5 },
      { at: T0 + 10 * M, cars: 0 },
      { at: T0 + 40 * M, cars: 0 },
      { at: T0 + 50 * M, cars: 2 },
    ]
    const s = analyseHistory(p, null)!
    expect(s.deadMinutes).toBe(30)
    expect(s.coverage).toBeCloseTo(20 / 50, 9)
    expect(s.avg).toBeCloseTo(2.5, 9)
    expect(s.fillRate).toBeNull()
  })
  it('< 2 điểm hoặc toàn khoảng 0 ms → null', () => {
    expect(analyseHistory([{ at: T0, cars: 1 }], 4)).toBeNull()
    expect(analyseHistory([{ at: T0, cars: 1 }, { at: T0, cars: 2 }], 4)).toBeNull()
  })
  it('khung giờ < 5 phút dữ liệu không được xếp hạng', () => {
    const p: HistoryPoint[] = [
      { at: T0 + 57 * M, cars: 9 }, // 3 phút cuối của giờ 10
      { at: T0 + H, cars: 1 },
      { at: T0 + 2 * H, cars: 1 },
    ]
    const s = analyseHistory(p, null)!
    expect(s.byHour[10].thin).toBe(true)
    expect(s.peakHour).toBe(11)
    expect(s.peak).toBe(9)
  })
})

describe('windowHistory', () => {
  const now = T0 + 24 * H
  it('thêm điểm ở mốc cắt mang giá trị đang có, kéo giá trị cuối tới now', () => {
    const p: HistoryPoint[] = [
      { at: now - 10 * H, cars: 3 },
      { at: now - 2 * H, cars: 5 },
      { at: now - H, cars: 1 },
    ]
    expect(windowHistory(p, 6, now)).toEqual([
      { at: now - 6 * H, cars: 3 },
      { at: now - 2 * H, cars: 5 },
      { at: now - H, cars: 1 },
      { at: now, cars: 1 },
    ])
  })
  it('điểm cuối quá 3 giờ thì không kéo tới now', () => {
    const p: HistoryPoint[] = [
      { at: now - 10 * H, cars: 3 },
      { at: now - 5 * H, cars: 2 },
    ]
    expect(windowHistory(p, 6, now)).toEqual([
      { at: now - 6 * H, cars: 3 },
      { at: now - 5 * H, cars: 2 },
    ])
  })
  it('rỗng → nguyên mảng; mọi điểm đều cũ → chỉ còn điểm mốc cắt + kéo tới now', () => {
    const empty: HistoryPoint[] = []
    expect(windowHistory(empty, 6, now)).toBe(empty)
    // Điểm mốc cắt (now-6h) cũng tính là "điểm cuối" — cũ hơn 3 giờ nên không kéo.
    expect(windowHistory([{ at: now - 10 * H, cars: 4 }], 6, now)).toEqual([{ at: now - 6 * H, cars: 4 }])
    expect(windowHistory([{ at: now - 10 * H, cars: 4 }], 2, now)).toEqual([
      { at: now - 2 * H, cars: 4 },
      { at: now, cars: 4 },
    ])
  })
})

describe('estimateFromHistory', () => {
  const now = T0 + 24 * H
  const hist = (all: HistoryPoint[], byKw: Array<[number, HistoryPoint[]]> = []): LiveHistory => ({ all, byKw: new Map(byKw) })
  it('trừ số xe ở điểm cuối từng chuỗi kW vào số cổng, kẹp ở 0', () => {
    const h = hist([{ at: now - 10 * M, cars: 5 }], [
      [150, [{ at: now - 5 * H, cars: 1 }]],
      [60, [{ at: now - 20 * M, cars: 9 }]],
    ])
    const r = estimateFromHistory(h, [{ kw: 60, count: 4 }, { kw: 150, count: 2 }], now)
    expect(r).toEqual({
      ports: [
        { kw: 150, free: 1, total: 2 },
        { kw: 60, free: 0, total: 4 },
      ],
      charging: 5,
      at: now,
    })
  })
  it('không có chuỗi theo kW: chỉ ước tính khi trạm có đúng một mức', () => {
    const h = hist([{ at: now - M, cars: 3 }])
    expect(estimateFromHistory(h, [{ kw: 60, count: 4 }], now)?.ports).toEqual([{ kw: 60, free: 1, total: 4 }])
    expect(estimateFromHistory(h, [{ kw: 60, count: 4 }, { kw: 150, count: 2 }], now)).toBeNull()
  })
  it('null / không nhóm / điểm cuối cũ hơn 3 giờ → null', () => {
    expect(estimateFromHistory(null, [{ kw: 60, count: 4 }], now)).toBeNull()
    expect(estimateFromHistory(hist([{ at: now, cars: 1 }]), [], now)).toBeNull()
    expect(estimateFromHistory(hist([{ at: now - 3 * H - 1, cars: 1 }]), [{ kw: 60, count: 4 }], now)).toBeNull()
    expect(estimateFromHistory(hist([]), [{ kw: 60, count: 4 }], now)).toBeNull()
  })
})

describe('freeSummary', () => {
  it('cộng mọi mức kW; không có cổng → null', () => {
    const s = parseLive({}, 1)
    expect(freeSummary(s)).toBeNull()
    expect(freeSummary({ ...s, ports: [{ kw: 150, free: 1, total: 4 }, { kw: 60, free: 2, total: 2 }] })).toEqual({ free: 3, total: 6 })
  })
})
