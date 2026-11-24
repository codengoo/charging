/**
 * Hành trình Dọc đường mở gần đây (mới nhất trước), lưu trên máy — bấm chip Dọc đường là mở lại
 * được, không phải dán link lần nữa. Lưu link Google Maps gốc + tên chặng để hiện.
 */
import { useCallback, useState } from 'react'
import { readJson, writeJson } from '../lib/storage'

export interface RecentTrip {
  link: string
  /** "Hà Nội → Vinh" — tên các chặng lúc mở. */
  label: string
  at: number
}

const KEY = 'tramsac.trips'
export const RECENT_TRIPS_MAX = 5

export function parseTrips(v: unknown): RecentTrip[] {
  if (!Array.isArray(v)) return []
  const out: RecentTrip[] = []
  for (const e of v) {
    if (!e || typeof e !== 'object') continue
    const o = e as Partial<RecentTrip>
    if (typeof o.link === 'string' && o.link && typeof o.label === 'string' && typeof o.at === 'number') {
      out.push({ link: o.link, label: o.label, at: o.at })
    }
  }
  return out.slice(0, RECENT_TRIPS_MAX)
}

/** Đưa lên đầu; cùng link thì thay bản cũ (tên chặng có thể đã đổi). */
export function pushTrip(list: RecentTrip[], t: RecentTrip): RecentTrip[] {
  return [t, ...list.filter((x) => x.link !== t.link)].slice(0, RECENT_TRIPS_MAX)
}

export function useRecentTrips() {
  const [trips, setTrips] = useState<RecentTrip[]>(() => parseTrips(readJson(KEY)))
  const push = useCallback((t: RecentTrip) => {
    setTrips((cur) => {
      if (cur[0]?.link === t.link && cur[0].label === t.label) return cur
      const next = pushTrip(cur, t)
      writeJson(KEY, next)
      return next
    })
  }, [])
  const remove = useCallback((link: string) => {
    setTrips((cur) => {
      const next = cur.filter((x) => x.link !== link)
      writeJson(KEY, next)
      return next
    })
  }, [])
  return { trips, push, remove }
}
