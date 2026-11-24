/**
 * Thời tiết tại trạm (Open-Meteo qua Worker `/api/weather`, xem worker/weather.ts). Chỉ tải khi người
 * dùng MỞ một trạm; nhớ trong bộ nhớ 10 phút theo ô lưới ~5 km (khớp Worker).
 */
import { useEffect, useState } from 'react'
import { pick } from '../i18n'
import { fetchJson } from '../lib/http'

export type WeatherIcon = 'sun' | 'moon' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'storm'

export interface WeatherNow {
  temp: number
  feels: number
  code: number
  windKmh: number
  isDay: boolean
}

export interface WeatherHour {
  /** Giờ địa phương 0–23. */
  hour: number
  temp: number
  /** Xác suất mưa (%); null = không có số. */
  rainPct: number | null
  code: number
}

export interface Weather {
  now: WeatherNow
  /** Các giờ SAU giờ hiện tại (tối đa 6) — hộp thời tiết ở bảng trạm. */
  hours: WeatherHour[]
  /** Mọi giờ dự báo (tới 24 giờ), khoá "YYYY-MM-DDTHH" giờ địa phương — tra theo giờ tới trạm. */
  series: Map<string, WeatherHour>
  /** Lệch múi giờ của trạm so với UTC (giây). */
  utcOffsetSec: number
}

interface Body {
  utc_offset_seconds?: number
  current?: { time?: string; temperature_2m?: number; apparent_temperature?: number; weather_code?: number; wind_speed_10m?: number; is_day?: number }
  hourly?: { time?: string[]; temperature_2m?: number[]; precipitation_probability?: (number | null)[]; weather_code?: number[] }
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
/** "2026-11-24T16:00" (giờ địa phương của trạm, timezone=auto) → 16. */
const hourOf = (iso: string) => Number(iso.slice(11, 13))

export function parseWeather(b: Body): Weather | null {
  const c = b.current
  if (!c || !num(c.temperature_2m) || !num(c.weather_code)) return null
  const now: WeatherNow = {
    temp: c.temperature_2m,
    feels: num(c.apparent_temperature) ? c.apparent_temperature : c.temperature_2m,
    code: c.weather_code,
    windKmh: num(c.wind_speed_10m) ? c.wind_speed_10m : 0,
    isDay: c.is_day !== 0,
  }
  const h = b.hourly
  const nowKey = (c.time ?? '').slice(0, 13) // "2026-11-24T16"
  const hours: WeatherHour[] = []
  const series = new Map<string, WeatherHour>()
  for (let i = 0; i < (h?.time?.length ?? 0); i++) {
    const t = h!.time![i]
    const temp = h!.temperature_2m?.[i]
    const code = h!.weather_code?.[i]
    if (!num(temp) || !num(code)) continue
    const rain = h!.precipitation_probability?.[i]
    const wh = { hour: hourOf(t), temp, code, rainPct: num(rain) ? rain : null }
    series.set(t.slice(0, 13), wh)
    // Hộp ở bảng trạm: chỉ các giờ sau giờ hiện tại (giờ đang diễn ra đã có ở `now`).
    if (nowKey && t.slice(0, 13) > nowKey && hours.length < 6) hours.push(wh)
  }
  return { now, hours, series, utcOffsetSec: num(b.utc_offset_seconds) ? b.utc_offset_seconds : 7 * 3600 }
}

const L = pick({
  vi: {
    clear: 'Trời quang', partly: 'Ít mây', cloudy: 'Nhiều mây', overcast: 'U ám', fog: 'Sương mù',
    drizzle: 'Mưa phùn', rain: 'Mưa', heavyRain: 'Mưa to', showers: 'Mưa rào', storm: 'Dông', snow: 'Tuyết',
  },
  en: {
    clear: 'Clear', partly: 'Partly cloudy', cloudy: 'Cloudy', overcast: 'Overcast', fog: 'Fog',
    drizzle: 'Drizzle', rain: 'Rain', heavyRain: 'Heavy rain', showers: 'Showers', storm: 'Thunderstorm', snow: 'Snow',
  },
})

/** Mã thời tiết WMO (Open-Meteo) → chữ + biểu tượng. */
export function describe(code: number, isDay = true): { label: string; icon: WeatherIcon } {
  if (code === 0) return { label: L.clear, icon: isDay ? 'sun' : 'moon' }
  if (code === 1 || code === 2) return { label: code === 1 ? L.partly : L.cloudy, icon: 'partly' }
  if (code === 3) return { label: L.overcast, icon: 'cloud' }
  if (code === 45 || code === 48) return { label: L.fog, icon: 'fog' }
  if (code >= 51 && code <= 57) return { label: L.drizzle, icon: 'drizzle' }
  if (code === 65 || code === 67 || code === 82) return { label: L.heavyRain, icon: 'rain' }
  if ((code >= 61 && code <= 67) || code === 80 || code === 81) return { label: code >= 80 ? L.showers : L.rain, icon: 'rain' }
  if (code >= 95) return { label: L.storm, icon: 'storm' }
  if (code >= 71 && code <= 86) return { label: L.snow, icon: 'cloud' }
  return { label: L.cloudy, icon: 'cloud' }
}

/** Dự báo của giờ chứa thời điểm `ms` (theo giờ địa phương của trạm); ngoài 24 giờ dự báo → null. */
export function weatherAt(w: Weather, ms: number): WeatherHour | null {
  const key = new Date(ms + w.utcOffsetSec * 1000).toISOString().slice(0, 13)
  return w.series.get(key) ?? null
}

/** Giờ đầu tiên trong 3 giờ tới có khả năng mưa ≥ ngưỡng — nhắc mang ô khi ra trạm. */
export const RAIN_ALERT_PCT = 50
export function rainSoon(w: Weather): WeatherHour | null {
  return w.hours.slice(0, 3).find((h) => (h.rainPct ?? 0) >= RAIN_ALERT_PCT) ?? null
}

const TTL_MS = 10 * 60_000
const cache = new Map<string, { at: number; v: Weather | null }>()
/** Khớp lưới 0,05° của Worker — trạm cạnh nhau dùng chung kết quả. */
const keyOf = (lat: number, lng: number) => `${(Math.round(lat / 0.05) * 0.05).toFixed(2)},${(Math.round(lng / 0.05) * 0.05).toFixed(2)}`

export type WeatherState = { kind: 'loading' } | { kind: 'ok'; weather: Weather } | { kind: 'error' }

/** Tải (hoặc lấy cache) thời tiết một ô lưới. Lỗi → null, thử lại sau 1 phút. */
async function load(key: string, signal: AbortSignal): Promise<void> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return
  try {
    const b = await fetchJson<Body>(`/api/weather?at=${key}`, { signal })
    cache.set(key, { at: Date.now(), v: parseWeather(b) })
  } catch {
    if (!signal.aborted) cache.set(key, { at: Date.now() - TTL_MS + 60_000, v: null })
  }
}

/**
 * Thời tiết tại nhiều điểm (điểm dừng của kế hoạch sạc) — tối đa `max` ô lưới, tuần tự để không dồn
 * giới hạn `/api`. Trả map toạ độ "lat,lng" của điểm → Weather (thiếu = chưa có / lỗi).
 */
export function useWeatherMany(points: { lat: number; lng: number }[], enabled: boolean, max = 5): Map<string, Weather> {
  const keys = [...new Set(points.slice(0, max).map((p) => keyOf(p.lat, p.lng)))]
  const sig = keys.join(';')
  const [, bump] = useState(0)
  useEffect(() => {
    if (!enabled || !sig) return
    const ctrl = new AbortController()
    void (async () => {
      for (const k of sig.split(';')) {
        if (ctrl.signal.aborted) return
        const before = cache.get(k)
        await load(k, ctrl.signal)
        if (!ctrl.signal.aborted && cache.get(k) !== before) bump((n) => n + 1)
      }
    })()
    return () => ctrl.abort()
  }, [sig, enabled])
  const out = new Map<string, Weather>()
  for (const p of points.slice(0, max)) {
    const v = cache.get(keyOf(p.lat, p.lng))?.v
    if (v) out.set(`${p.lat},${p.lng}`, v)
  }
  return out
}

export function useWeather(at: { lat: number; lng: number } | null, enabled: boolean): WeatherState | null {
  const key = at ? keyOf(at.lat, at.lng) : null
  const [, bump] = useState(0)
  useEffect(() => {
    if (!enabled || !key) return
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) return
    const ctrl = new AbortController()
    fetchJson<Body>(`/api/weather?at=${key}`, { signal: ctrl.signal })
      .then((b) => cache.set(key, { at: Date.now(), v: parseWeather(b) }))
      .catch(() => {
        if (!ctrl.signal.aborted) cache.set(key, { at: Date.now() - TTL_MS + 60_000, v: null }) // lỗi: thử lại sau 1 phút
      })
      .finally(() => !ctrl.signal.aborted && bump((n) => n + 1))
    return () => ctrl.abort()
  }, [key, enabled])
  if (!key) return null
  const hit = cache.get(key)
  if (!hit) return { kind: 'loading' }
  return hit.v ? { kind: 'ok', weather: hit.v } : { kind: 'error' }
}
