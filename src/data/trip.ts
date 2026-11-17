/**
 * Client của `/api/*` (worker/api.ts) + dịch đoạn chia sẻ / link Google Maps thành các chặng có
 * toạ độ. Port phần mạng của MapsLink.kt, HereRouting.path, HerePlaces và
 * MapViewModel.handleSharedText (charge-map-android).
 */
import type { GeoPoint } from '../lib/geo'
import { firstUrl, hasFix, isShortLink, parseMapsUrl, type Avoid, type TripStop } from '../lib/mapsLink'
import type { RoutePath } from './tripTypes'
import { parseHereRoutes, type HereRoute } from './here'
import { pick } from '../i18n'
import { HttpError, fetchJson } from '../lib/http'

/** Một chặng đã có toạ độ, kèm tên để hiện. */
export interface TripPoint {
  label: string
  lat: number
  lng: number
}

/** Kết quả đọc link: chặng có toạ độ + những gì link ghi thêm (xem ParsedLink). */
export interface ResolvedTrip {
  points: TripPoint[]
  /** vias[i] = điểm kéo tuyến giữa points[i] và points[i+1]; dài bằng `points`. */
  vias: GeoPoint[][]
  avoid: Avoid
  googleRoute: number | null
}

/** Một điểm gửi HERE; `pass` = chỉ đi qua (điểm kéo tuyến), không tạo chặng dừng. */
export type Waypoint = GeoPoint & { pass?: boolean }

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

async function api<T>(path: string, signal: AbortSignal): Promise<T | null> {
  try {
    return await fetchJson<T>(path, { signal })
  } catch (e) {
    if (!(e instanceof HttpError)) throw e
    if (e.status === 0) throw e.cause
    if (e.status === 429) throw new TripError(MSG.tooFast)
    if (e.status === 503) throw new TripError(MSG.noKey)
    return null
  }
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

/** Chặng xen kẽ điểm kéo tuyến, đúng thứ tự đi. */
export function waypointsOf(stops: GeoPoint[], vias: GeoPoint[][]): Waypoint[] {
  return stops.flatMap((p, i): Waypoint[] => [
    { lat: p.lat, lng: p.lng },
    ...(i < stops.length - 1 ? (vias[i] ?? []).map((v) => ({ lat: v.lat, lng: v.lng, pass: true })) : []),
  ])
}

/** `alt` = số tuyến khác muốn xin thêm (Worker bỏ qua khi có điểm giữa). Rỗng = không tìm được. */
export async function fetchRoutes(
  waypoints: Waypoint[],
  opts: { alt: number; avoid: Avoid },
  signal: AbortSignal,
): Promise<RoutePath[]> {
  if (waypoints.length < 2) return []
  const params = new URLSearchParams({ stops: waypoints.map((p) => `${p.lat},${p.lng}${p.pass ? '!p' : ''}`).join(';') })
  if (opts.alt > 0) params.set('alt', String(opts.alt))
  const avoid = (['toll', 'highway', 'ferry'] as const).filter((k) => opts.avoid[k])
  if (avoid.length) params.set('avoid', avoid.join(','))
  const body = await api<HereRoute>(`/api/route?${params}`, signal)
  const routes = body ? parseHereRoutes(body) : []
  // Phòng HERE từ chối `alternatives` với tổ hợp nào đó: xin lại đúng một tuyến.
  if (routes.length === 0 && opts.alt > 0) return fetchRoutes(waypoints, { ...opts, alt: 0 }, signal)
  return routes
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
): Promise<ResolvedTrip> {
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

  const vias = parsed.vias
  if (needGps) {
    if (!me) throw new TripError(MSG.noGps)
    points.unshift({ label: MSG.myLocation, lat: me.lat, lng: me.lng })
    vias.unshift([])
  }
  return { points, vias, avoid: parsed.avoid, googleRoute: parsed.googleRoute }
}
