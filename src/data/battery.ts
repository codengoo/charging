/**
 * Ước tính % pin khi đến trạm + thời gian sạc lên 80%. Tính hoàn toàn ở client từ quãng đường
 * đã có (`/api/drive`, km trên tuyến của routeCorridor) — không gọi thêm HERE / EVCS.
 *
 * Mô hình cố ý đơn giản: tiêu thụ cố định theo xe × hệ số tốc độ trung bình × điều hoà, hiện
 * thành KHOẢNG ±8% thay vì một con số chính xác giả. Không tính độ dốc (đường đèo tốn hơn).
 */
import { useCallback, useState } from 'react'
import type { LivePorts } from './live'
import type { StationPower } from './types'
import type { Vehicle } from './vehicles'
import { readJson, writeJson } from '../lib/storage'

/** % pin người dùng nhập, kèm lúc nhập. */
export interface BatteryReading {
  pct: number
  at: number
}

/** % pin khi đến; `low` = bi quan, `high` = lạc quan. Có thể âm (không tới được). */
export interface ArrivalEstimate {
  low: number
  high: number
}

/** Nhập quá 2 giờ thì coi là cũ — vẫn tính, nhưng nhắc nhập lại. */
export const STALE_MS = 2 * 60 * 60 * 1000
/** "Còn kịp" = ước tính bi quan vẫn còn ít nhất mức này. Mặc định; người dùng đổi ở Settings.reservePct. */
export const RESERVE_PCT = 10
/** Mẫu pin dự phòng trong "Xe của bạn"; ngoài các mức này người dùng tự nhập trong RESERVE_MIN..RESERVE_MAX. */
export const RESERVE_OPTIONS = [10, 15, 20, 30] as const
export const RESERVE_MIN = 1
export const RESERVE_MAX = 50
export const TARGET_PCT = 80
/** % pin hiện khi chưa nhập lần nào. */
export const DEFAULT_PCT = 80
const CLIMATE = 1.08
const SPREAD = 0.08

/** Đi phố chậm tốn ít hơn (tái sinh khi phanh), cao tốc tốn hơn hẳn (cản gió). */
export function speedFactor(avgKmh: number): number {
  if (avgKmh < 40) return 0.95
  if (avgKmh < 70) return 1
  if (avgKmh < 90) return 1.12
  return 1.25
}

export function arrivalPct(startPct: number, km: number, avgKmh: number, v: Vehicle, climate: boolean): ArrivalEstimate {
  const kwh = ((km * v.kwhPer100) / 100) * speedFactor(avgKmh) * (climate ? CLIMATE : 1)
  const used = (kwh / v.kwh) * 100
  return { low: startPct - used * (1 + SPREAD), high: startPct - used * (1 - SPREAD) }
}

/** Tốc độ trung bình giả định khi không có thời gian lái (đường hỗn hợp). */
export const FALLBACK_KMH = 50

/** Tốc độ trung bình (km/h) của một quãng; thiếu thời gian thì coi như đường hỗn hợp. */
export function avgKmh(meters: number, seconds: number): number {
  return seconds > 0 ? meters / 1000 / (seconds / 3600) : FALLBACK_KMH
}

export interface ChargePort {
  kw: number
  dc: boolean
}

/**
 * Cổng sẽ cắm: mạnh nhất còn trống theo live nếu có, không thì nhóm cổng mạnh nhất (ưu tiên DC).
 * Live chỉ có kW — tra AC/DC theo nhóm cổng, không có thì trên 22 kW là DC.
 */
export function chargePort(power: StationPower | undefined, live: LivePorts[] | null): ChargePort | null {
  const groups = power?.groups ?? []
  const free = live?.filter((p) => p.free > 0).sort((a, b) => b.kw - a.kw)[0]
  if (free) return { kw: free.kw, dc: groups.find((g) => g.kw === free.kw)?.dc ?? free.kw > 22 }
  const best = [...groups].sort((a, b) => Number(b.dc) - Number(a.dc) || b.kw - a.kw)[0]
  return best ? { kw: best.kw, dc: best.dc } : null
}

/**
 * Phút sạc từ `fromPct` lên `toPct` (mặc định 80%). DC: xe giữ trung bình ~75% công suất đỉnh
 * dưới 80%; AC gần như phẳng (~90%). Đã đủ → null.
 */
export function chargeMinutes(fromPct: number, port: ChargePort, v: Vehicle, toPct = TARGET_PCT): number | null {
  if (fromPct >= toPct) return null
  const kw = port.dc ? Math.min(port.kw, v.dcKw) * 0.75 : Math.min(port.kw, v.acKw) * 0.9
  if (kw <= 0) return null
  const kwh = ((toPct - Math.max(0, fromPct)) / 100) * v.kwh
  return (kwh / kw) * 60
}

const KEY = 'tramsac.battery'

function load(): BatteryReading | null {
  // JSON hỏng / localStorage bị chặn → như chưa nhập
  const o = readJson(KEY) as Partial<BatteryReading> | null
  if (o && typeof o.pct === 'number' && typeof o.at === 'number' && o.pct >= 0 && o.pct <= 100) return { pct: o.pct, at: o.at }
  return null
}

/** % pin hiện tại, dùng chung cho bảng trạm và Dọc đường (một instance ở App). */
export function useBattery() {
  const [reading, setReading] = useState<BatteryReading | null>(load)

  const set = useCallback((pct: number) => {
    const next = { pct: Math.round(Math.min(100, Math.max(0, pct))), at: Date.now() }
    setReading(next)
    writeJson(KEY, next) // không lưu được thì vẫn dùng trong phiên
  }, [])

  const stale = reading !== null && Date.now() - reading.at > STALE_MS
  return { reading, stale, set }
}
