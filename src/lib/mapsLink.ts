/**
 * Đọc liên kết chia sẻ của Google Maps. Port phần parse của MapsLink.kt (charge-map-android);
 * việc mở link rút gọn chạy ở Worker (`/api/maps-link`), xem src/data/trip.ts.
 *
 * KHÔNG có API chính thức nào cho việc này: Google chỉ đưa ra một địa chỉ web, và địa chỉ đó
 * đổi lúc nào cũng được, không báo trước. Vì thế mọi hàm trả null thay vì ném lỗi, nơi gọi phải
 * có đường báo cho người dùng khi không đọc được.
 *
 * Kể cả khi đọc được, ta CHỈ lấy các chặng chứ không lấy được đường đi — liên kết không chứa
 * đường. Tuyến được tính lại bằng HERE nên có thể lệch chút so với cái người dùng thấy trên Maps.
 */

/** Một chặng: có toạ độ, có tên, hoặc cả hai. Chỉ có tên thì phải nhờ HERE đoán toạ độ. */
export interface TripStop {
  lat?: number
  lng?: number
  text?: string
}

export const SHORTENER_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co']

const LATLNG_TEXT = /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/
/**
 * Toạ độ của địa điểm trong khối `data=`, dạng `!3d<vĩ độ>!4d<kinh độ>`. Xuất hiện theo ĐÚNG
 * thứ tự các chặng và chỉ cho chặng viết bằng TÊN (chặng là toạ độ trần thì không có cặp nào).
 */
const LATLNG_3D4D = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g
/**
 * Link chỉ đường còn ghi toạ độ chặng dạng `!1d<kinh độ>!2d<vĩ độ>` (KINH ĐỘ TRƯỚC) — bản
 * Android không đọc dạng này. Thấy trong link thật maps.app.goo.gl/Wa4BHQY94CRPMfuA7
 * (2026-11-16): `…!2m2!1d105.8007614!2d21.007222…`. Có cả hai dạng thì ưu tiên dạng này.
 */
const LNGLAT_1D2D = /!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/g

/** Rút địa chỉ web đầu tiên ra khỏi đoạn văn bản được chia sẻ. */
export function firstUrl(text: string): string | null {
  const m = /https?:\/\/\S+/.exec(text)
  return m ? m[0].replace(/[.,)"]+$/, '') : null
}

export function isShortLink(url: string): boolean {
  try {
    return SHORTENER_HOSTS.includes(new URL(url).hostname)
  } catch {
    return false
  }
}

/** Link đầy đủ → các chặng theo thứ tự đi; null nếu không đọc được. */
export function parseMapsUrl(url: string): TripStop[] | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const stops = readDirections(u, url) ?? readSinglePlace(u, url)
  return stops && stops.length > 0 && stops.every(usable) ? stops : null
}

function usable(s: TripStop): boolean {
  return hasFix(s) || !!s.text?.trim()
}

export function hasFix(s: TripStop): s is TripStop & { lat: number; lng: number } {
  return typeof s.lat === 'number' && typeof s.lng === 'number' && Number.isFinite(s.lat) && Number.isFinite(s.lng)
}

/**
 * Chỉ đường. Hai dạng Google dùng song song:
 *   …/maps/dir/?api=1&origin=…&waypoints=A|B&destination=…
 *   …/maps/dir/Điểm+đi/Điểm+dừng/Điểm+đến/@20.9,105.8,10z/data=!3d…!4d…
 * Đoạn bắt đầu bằng '@' là KHUNG NHÌN của bản đồ chứ không phải một chặng — bỏ qua.
 */
function readDirections(u: URL, raw: string): TripStop[] | null {
  if (!u.pathname.includes('/dir')) return null

  const dest = u.searchParams.get('destination')
  if (dest !== null) {
    const parts = [
      u.searchParams.get('origin') ?? '',
      // Nhiều điểm dừng ngăn nhau bằng '|'.
      ...(u.searchParams.get('waypoints') ?? '').split('|'),
      dest,
    ].filter((s) => s.trim())
    return parts.length ? parts.map(stopOf) : null
  }

  const segs = u.pathname.split('/')
  const at = segs.indexOf('dir')
  const segments = segs
    .slice(at + 1)
    .filter((s) => s && !s.startsWith('@') && !s.startsWith('data='))
    .map(decodeSegment)
  if (segments.length === 0) return null

  // Các cặp toạ độ trong `data=`, ăn theo thứ tự vào các chặng CÓ TÊN.
  const lngLat = [...raw.matchAll(LNGLAT_1D2D)].map((m) => ({ lat: +m[2], lng: +m[1] }))
  const fixes = lngLat.length > 0 ? lngLat : [...raw.matchAll(LATLNG_3D4D)].map((m) => ({ lat: +m[1], lng: +m[2] }))

  let next = 0
  return segments.map((seg) => {
    if (LATLNG_TEXT.test(seg)) return stopOf(seg)
    // Hết cặp toạ độ thì giữ lại tên, để nơi gọi nhờ HERE đoán sau.
    const fix = fixes[next++]
    return fix ? { lat: fix.lat, lng: fix.lng, text: seg } : { text: seg }
  })
}

/**
 * Liên kết chỉ trỏ tới MỘT địa điểm: coi là ĐIỂM ĐẾN, điểm đi lấy vị trí hiện tại.
 * Toạ độ thử lần lượt: `?q=20.9,105.8` | `!3d…!4d…` trong `data=` | `/@20.9,105.8,17z`.
 */
function readSinglePlace(u: URL, raw: string): TripStop[] | null {
  const q = u.searchParams.get('q')
  if (q?.trim()) return [stopOf(q)]

  const segs = u.pathname.split('/')
  const at = segs.indexOf('place')
  const nameSeg = at >= 0 ? segs[at + 1] : undefined
  const name = nameSeg && !nameSeg.startsWith('@') ? decodeSegment(nameSeg).trim() || undefined : undefined

  const fix = new RegExp(LATLNG_3D4D.source).exec(raw)
  if (fix) return [{ lat: +fix[1], lng: +fix[2], text: name }]

  // '@' là khung nhìn, không phải địa điểm — chỉ dùng khi không còn gì khác.
  const view = /\/@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(raw)
  if (view) return [{ lat: +view[1], lng: +view[2], text: name }]

  return name ? [{ text: name }] : null
}

function decodeSegment(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '))
  } catch {
    return s.replace(/\+/g, ' ')
  }
}

function stopOf(raw: string): TripStop {
  if (LATLNG_TEXT.test(raw)) {
    const [lat, lng] = raw.split(',').map((x) => parseFloat(x.trim()))
    return { lat, lng }
  }
  return { text: raw.trim() }
}
