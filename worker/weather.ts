// /api/weather?at=lat,lng → thời tiết hiện tại + 6 giờ tới tại trạm, từ Open-Meteo (miễn phí, không key,
// CC BY 4.0 — ghi công trong app; dùng thương mại cần gói trả phí). Toạ độ làm tròn 0,05° (~5 km) để các
// trạm gần nhau dùng chung một lượt gọi; cache 15 phút ở edge. Worker chỉ chuyển nguyên body.

import { fail, jsonText } from './http'

const COORD = /^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/
const GRID = 0.05
const TTL_S = 15 * 60

/** Làm tròn về lưới GRID; ngoài khoảng hợp lệ → null. */
export function gridCoord(at: string): { lat: string; lng: string } | null {
  const m = COORD.exec(at)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return null
  const snap = (v: number) => (Math.round(v / GRID) * GRID).toFixed(2)
  return { lat: snap(lat), lng: snap(lng) }
}

export async function serveWeather(url: URL, ctx: ExecutionContext): Promise<Response> {
  const g = gridCoord(url.searchParams.get('at') ?? '')
  if (!g) return fail(400, 'at không hợp lệ')
  const cache = caches.default
  const key = new Request(`https://weather-cache.internal/${g.lat},${g.lng}`)
  const hit = await cache.match(key)
  if (hit) return hit

  const target = new URL('https://api.open-meteo.com/v1/forecast')
  target.searchParams.set('latitude', g.lat)
  target.searchParams.set('longitude', g.lng)
  target.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m,is_day')
  target.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weather_code')
  // 24 giờ: bảng trạm hiện 6 giờ tới, kế hoạch sạc dọc đường tra thời tiết lúc tới từng điểm dừng.
  target.searchParams.set('forecast_hours', '24')
  target.searchParams.set('timezone', 'auto')
  const up = await fetch(target.toString(), { headers: { Accept: 'application/json' } })
  if (!up.ok) return fail(502, 'Không lấy được thời tiết')
  const res = jsonText(await up.text(), 200, `public, max-age=${TTL_S}`)
  ctx.waitUntil(cache.put(key, res.clone()))
  return res
}

