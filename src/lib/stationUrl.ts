/**
 * Đường dẫn chia sẻ của một trạm. Dùng chung cho app (client) và Worker
 * (`worker/index.ts`, route `/station/*`) — giữ MỘT chỗ định nghĩa để hai bên
 * không lệch nhau.
 *
 * Dạng: `/station/<entityId>-<slug>` (trước 0.7.0 là `/tram/…`, Worker 301 sang). Chỉ id là thứ để tra; slug chỉ để link đọc được và tốt
 * cho SEO — sai slug (trạm đổi tên) thì server chuyển 301 về slug đúng.
 */

/** Domain chính thức — dùng khi đang chạy local (QR trỏ về localhost thì điện thoại không mở được). */
export const SITE_URL = 'https://charging.cangao.asia'

/** Hạ dấu tiếng Việt + gạch nối: "Vincom Hầm B3" -> "vincom-ham-b3". */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
}

/** Tiền tố path trạm. `/tram/*` cũ (QR đã in, link đã gửi) được Worker 301 về đây. */
export const STATION_PREFIX = '/station/'

export function stationPath(st: { entityId: string; name: string }): string {
  const slug = slugify(st.name)
  return `${STATION_PREFIX}${st.entityId}${slug ? `-${slug}` : ''}`
}

/** Lấy entityId từ pathname `/station/<id>-<slug>`. Không khớp thì null. */
export function parseStationId(pathname: string): string | null {
  const m = /^\/station\/(\d+)(?:-[^/]*)?\/?$/.exec(pathname)
  return m ? m[1] : null
}

/** Origin để đưa vào link chia sẻ / QR. */
export function shareOrigin(): string {
  // File này cũng được Worker import (không có `location`) — đọc qua globalThis, không cần lib DOM.
  const loc = (globalThis as { location?: { hostname: string; origin: string } }).location
  if (!loc) return SITE_URL
  const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(loc.hostname)
  return local ? SITE_URL : loc.origin
}

export function stationShareUrl(st: { entityId: string; name: string }): string {
  return shareOrigin() + stationPath(st)
}

/**
 * Link Google Maps tới đúng toạ độ trạm. Trên điện thoại có app Google Maps thì hệ điều
 * hành mở thẳng app; không có thì mở bản web.
 */
export function googleMapsUrl(st: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${st.lat},${st.lng}`
}

/** Trang hành trình "trạm dọc đường": `/trip?link=<link Google Maps>`. Không cần Worker (SPA). */
export const TRIP_PATH = '/trip'

export function tripPath(link: string | null): string {
  return link ? `${TRIP_PATH}?link=${encodeURIComponent(link)}` : TRIP_PATH
}

/**
 * Link hành trình trong URL lúc mở app. `link` do app ghi; `url` / `text` do Web Share Target gửi
 * (Google Maps Android để link trong `text` kèm tên địa điểm, có khi trong `url`) — trả nguyên
 * đoạn text, nơi gọi tự rút link ra. `undefined` = không phải trang hành trình; `null` = trang
 * hành trình chưa có link.
 */
export function readTripLink(loc: { pathname: string; search: string }): string | null | undefined {
  if (loc.pathname !== TRIP_PATH && loc.pathname !== `${TRIP_PATH}/`) return undefined
  const q = new URLSearchParams(loc.search)
  return q.get('link') || q.get('url') || q.get('text') || null
}
