import { useCallback, useState } from 'react'
import { readJson, writeJson } from '../lib/storage'
import { STALE_MS, type BatteryReading } from './battery'

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

  /** Thay nguyên bản ghi (đổi Xe 1 / Xe 2 — mỗi xe nhớ % pin riêng); null = như chưa nhập. */
  const replace = useCallback((next: BatteryReading | null) => {
    setReading(next)
    writeJson(KEY, next)
  }, [])

  const stale = reading !== null && Date.now() - reading.at > STALE_MS
  return { reading, stale, set, replace }
}
