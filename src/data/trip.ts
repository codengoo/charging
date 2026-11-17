/**
 * Client của `/api/*` (worker/api.ts) + dịch đoạn chia sẻ / link Google Maps thành các chặng có
 * toạ độ. Port phần mạng của MapsLink.kt, HereRouting.path, HerePlaces và
 * MapViewModel.handleSharedText (charge-map-android).
 */
import { decodeFlexiblePolyline, type GeoPoint } from '../lib/flexiblePolyline'
import { firstUrl, hasFix, isShortLink, parseMapsUrl, type TripStop } from '../lib/mapsLink'
import type { RoutePath } from './routeCorridor'
import { pick } from '../i18n'

/** Một chặng đã có toạ độ, kèm tên để hiện. */
export interface TripPoint {
  label: string
  lat: number
  lng: number
}

/** Lỗi có câu tiếng Việt hiện thẳng cho người dùng. */
export class TripError extends Error {}

export const MSG = pick({
  vi: {
    badLink: 'Không đọc được liên kết Google Maps này.',
    badStop: 'Không xác định được một trong các điểm của hành trình.',
    noGps: 'Chưa lấy được vị trí của bạn — bật định vị rồi thử lại.',
    noRoute: 'Không tìm được đường giữa các điểm này. Kiểm tra mạng rồi thử lại.',
    tooFast: 'Gọi quá nhanh, thử lại sau ít phút.',
    noKey: 'Máy chủ chưa cấu hình dịch vụ tìm đường.',
    myLocation: 'Vị trí của tôi',
  },
  en: {
    badLink: "Couldn't read this Google Maps link.",
    badStop: "Couldn't locate one of the stops on this trip.",
    noGps: "Couldn't get your location — turn on location services and try again.",
    noRoute: "Couldn't find a route between these points. Check your connection and try again.",
    tooFast: 'Too many requests, try again in a few minutes.',
    noKey: 'The server has no routing service configured.',
    myLocation: 'My location',
  },
})

/** functionalClass 1 = hạng cao nhất (cao tốc / đường có kiểm soát lối ra). */
const LIMITED_ACCESS_CLASS = 1

async function api<T>(path: string, signal: AbortSignal): Promise<T | null> {
  const res = await fetch(path, { signal })
  if (res.status === 429) throw new TripError(MSG.tooFast)
  if (res.status === 503) throw new TripError(MSG.noKey)
  if (!res.ok) return null
  return (await res.json()) as T
}

/** Mở link rút gọn ở Worker; null nếu không mở được. */
export async function expandLink(url: string, signal: AbortSignal): Promise<string | null> {
  const r = await api<{ url?: string }>(`/api/maps-link?url=${encodeURIComponent(url)}`, signal)
  return r?.url ?? null
}

interface HereItems {
  items?: Array<{ title?: string; address?: { label?: string }; position?: { lat?: number; lng?: number } }>
}

/** Tên → toạ độ. Có `at` thì HERE xếp kết quả gần đó trước (discover). */
export async function geocode(q: string, at: GeoPoint | null, signal: AbortSignal): Promise<TripPoint | null> {
  const params = new URLSearchParams({ q })
  if (at) params.set('at', `${at.lat},${at.lng}`)
  const r = await api<HereItems>(`/api/geocode?${params}`, signal)
  const it = r?.items?.[0]
  const lat = it?.position?.lat
  const lng = it?.position?.lng
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  return { label: it?.title || q, lat, lng }
}

/** Toạ độ → tên chỗ; null khi hỏng (nơi gọi phải có đường lui). */
export async function reverse(p: GeoPoint, signal: AbortSignal): Promise<string | null> {
  const r = await api<HereItems>(`/api/revgeocode?at=${p.lat},${p.lng}`, signal)
  const it = r?.items?.[0]
  return it?.title?.trim() || it?.address?.label?.trim() || null
}

interface HereSpan {
  offset?: number
  functionalClass?: number
}
interface HereRoute {
  routes?: Array<{
    sections?: Array<{ polyline?: string; summary?: { length?: number; duration?: number }; spans?: HereSpan[] }>
  }>
}

/**
 * Mảng spans của HERE → một cờ cho TỪNG điểm. Mỗi span có `offset` là chỉ số điểm đầu, kéo dài tới
 * ngay trước `offset` của span kế tiếp. Không có spans thì coi như không đoạn nào là cao tốc —
 * mất tính năng lọc chiều ngược, nhưng không bao giờ bỏ nhầm trạm.
 */
export function limitedFlags(spans: HereSpan[] | undefined, size: number): boolean[] {
  const out = new Array<boolean>(size).fill(false)
  if (!spans) return out
  for (let i = 0; i < spans.length; i++) {
    if (spans[i].functionalClass !== LIMITED_ACCESS_CLASS) continue
    const from = Math.min(Math.max(spans[i].offset ?? 0, 0), size)
    const to = Math.min(Math.max(spans[i + 1]?.offset ?? size, from), size)
    for (let k = from; k < to; k++) out[k] = true
  }
  return out
}

/** Body HERE Routing v8 → đường đi. Tách riêng để test được không cần mạng. */
export function parseHereRoute(body: HereRoute): RoutePath | null {
  const sections = body.routes?.[0]?.sections
  if (!sections) return null
  const points: GeoPoint[] = []
  const limited: boolean[] = []
  let meters = 0
  let seconds = 0
  for (const sec of sections) {
    meters += sec.summary?.length ?? 0
    seconds += sec.summary?.duration ?? 0
    const pts = decodeFlexiblePolyline(sec.polyline ?? '')
    const flags = limitedFlags(sec.spans, pts.length)
    pts.forEach((pt, k) => {
      // Điểm nối giữa hai section bị lặp; bỏ điểm trùng thì phải bỏ cả cờ đi kèm, không thì hai
      // mảng lệch nhau từ đó trở đi (và đoạn dài 0 làm phép chiếu chia cho 0).
      const last = points[points.length - 1]
      if (last && last.lat === pt.lat && last.lng === pt.lng) return
      points.push(pt)
      limited.push(flags[k])
    })
  }
  return points.length >= 2 ? { points, limited, meters, seconds } : null
}

export async function fetchRoute(stops: GeoPoint[], signal: AbortSignal): Promise<RoutePath | null> {
  if (stops.length < 2) return null
  const q = stops.map((p) => `${p.lat},${p.lng}`).join(';')
  const body = await api<HereRoute>(`/api/route?stops=${q}`, signal)
  return body ? parseHereRoute(body) : null
}

/**
 * Một chặng → điểm có toạ độ và tên. Ưu tiên toạ độ có sẵn trong link: Google đã chốt địa điểm,
 * đổi tên qua HERE có thể ra chỗ khác cùng tên.
 */
async function resolvePoint(stop: TripStop, near: GeoPoint | null, signal: AbortSignal): Promise<TripPoint | null> {
  if (hasFix(stop)) {
    // Không có tên thì xin tên chỗ; hỏng mạng thì lùi về toạ độ rút gọn.
    const label =
      stop.text?.trim() || (await reverse(stop, signal).catch(() => null)) || `${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}`
    return { label, lat: stop.lat, lng: stop.lng }
  }
  const q = stop.text?.trim()
  return q ? geocode(q, near, signal) : null
}

/**
 * Đoạn chia sẻ / link → các chặng có toạ độ, điểm đi đầu tiên. Google BỎ điểm đi khỏi link khi đó
 * là vị trí hiện tại, nên link một chặng là chuyện thường: lấy GPS làm điểm đi.
 */
export async function resolveTrip(
  text: string,
  here: () => Promise<GeoPoint | null>,
  signal: AbortSignal,
): Promise<TripPoint[]> {
  const raw = firstUrl(text)
  if (!raw) throw new TripError(MSG.badLink)
  const full = isShortLink(raw) ? await expandLink(raw, signal) : raw
  const parsed = full ? parseMapsUrl(full) : null
  if (!parsed) throw new TripError(MSG.badLink)
  const stops = parsed.stops

  const needGps = stops.length === 1
  const me = needGps || stops.some((s) => !hasFix(s)) ? await here() : null
  const resolved = await Promise.all(stops.map((s) => resolvePoint(s, me, signal)))
  if (resolved.some((p) => p === null)) throw new TripError(MSG.badStop)
  const points = resolved as TripPoint[]

  if (needGps) {
    if (!me) throw new TripError(MSG.noGps)
    points.unshift({ label: MSG.myLocation, lat: me.lat, lng: me.lng })
  }
  return points
}
