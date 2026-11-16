/**
 * Đường dẫn chia sẻ của một trạm. Dùng chung cho app (client), Pages Function SEO
 * (`functions/tram/[[path]].ts`) và plugin sinh sitemap (seo.plugin.ts) — giữ MỘT chỗ định nghĩa để ba bên
 * không lệch nhau.
 *
 * Dạng: `/tram/<entityId>-<slug>`. Chỉ id là thứ để tra; slug chỉ để link đọc được và tốt
 * cho SEO — sai slug (trạm đổi tên) thì server chuyển 301 về slug đúng.
 */

/** Domain chính thức — dùng khi đang chạy local (QR trỏ về localhost thì điện thoại không mở được). */
export const SITE_URL = 'https://tramsac.pages.dev'

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

export function stationPath(st: { entityId: string; name: string }): string {
  const slug = slugify(st.name)
  return `/tram/${st.entityId}${slug ? `-${slug}` : ''}`
}

/** Lấy entityId từ pathname `/tram/<id>-<slug>`. Không khớp thì null. */
export function parseStationId(pathname: string): string | null {
  const m = /^\/tram\/(\d+)(?:-[^/]*)?\/?$/.exec(pathname)
  return m ? m[1] : null
}

/** Origin để đưa vào link chia sẻ / QR. */
export function shareOrigin(): string {
  if (typeof location === 'undefined') return SITE_URL
  const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname)
  return local ? SITE_URL : location.origin
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

/** Số shard dữ liệu SEO (`/seo/<n>.json`) — xem seo.plugin.ts. */
export const SEO_SHARDS = 128

export function seoShardOf(entityId: string): number {
  return Number(entityId) % SEO_SHARDS
}
