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
import type { GeoPoint } from './flexiblePolyline'

/** Một chặng: có toạ độ, có tên, hoặc cả hai. Chỉ có tên thì phải nhờ HERE đoán toạ độ. */
export interface TripStop {
  lat?: number
  lng?: number
  text?: string
}

export const SHORTENER_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co']

/** Tuỳ chọn tránh Google ghi trong link (khối `!2m…!1b1!2b1!3b1`). */
export interface Avoid {
  toll: boolean
  highway: boolean
  ferry: boolean
}
export const NO_AVOID: Avoid = { toll: false, highway: false, ferry: false }

/** Những gì đọc được từ một link: chặng, điểm kéo tuyến, tuỳ chọn tránh, tuyến đang chọn trên Google. */
export interface ParsedLink {
  stops: TripStop[]
  /** vias[i] = điểm kéo tuyến giữa stops[i] và stops[i+1]; dài bằng `stops`, phần tử cuối rỗng. */
  vias: GeoPoint[][]
  avoid: Avoid
  /** Tuyến đang chọn trên Google (`!5iN`, đếm từ 0); null nếu link không ghi. */
  googleRoute: number | null
}

const LATLNG_TEXT = /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/
/**
 * Toạ độ của địa điểm trong khối `data=`, dạng `!3d<vĩ độ>!4d<kinh độ>`. Xuất hiện theo ĐÚNG
 * thứ tự các chặng và chỉ cho chặng viết bằng TÊN (chặng là toạ độ trần thì không có cặp nào).
 */
const LATLNG_3D4D = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g

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

/** Link đầy đủ → chặng theo thứ tự đi + những gì link ghi thêm; null nếu không đọc được. */
export function parseMapsUrl(url: string): ParsedLink | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const parsed = readDirections(u, url) ?? plain(readSinglePlace(u, url))
  return parsed && parsed.stops.length > 0 && parsed.stops.every(usable) ? parsed : null
}

/** Chặng không kèm gì thêm (link không có khối `data=` chỉ đường). */
function plain(stops: TripStop[] | null): ParsedLink | null {
  return stops ? { stops, vias: stops.map(() => []), avoid: NO_AVOID, googleRoute: null } : null
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
 *   …/maps/dir/Điểm+đi/Điểm+dừng/Điểm+đến/@20.9,105.8,10z/data=!4m…
 * Đoạn bắt đầu bằng '@' là KHUNG NHÌN của bản đồ chứ không phải một chặng — bỏ qua.
 */
function readDirections(u: URL, raw: string): ParsedLink | null {
  if (!u.pathname.includes('/dir')) return null

  const dest = u.searchParams.get('destination')
  if (dest !== null) {
    const parts = [
      u.searchParams.get('origin') ?? '',
      // Nhiều điểm dừng ngăn nhau bằng '|'.
      ...(u.searchParams.get('waypoints') ?? '').split('|'),
      dest,
    ].filter((s) => s.trim())
    return parts.length ? plain(parts.map(stopOf)) : null
  }

  const segs = u.pathname.split('/')
  const at = segs.indexOf('dir')
  const segments = segs
    .slice(at + 1)
    .filter((s) => s && !s.startsWith('@') && !s.startsWith('data='))
    .map(decodeSegment)
  if (segments.length === 0) return null

  const pb = readPbDirections(raw)
  // Chặng ↔ waypoint khớp theo vị trí khi hai bên cùng số lượng (trường hợp thường gặp). Lệch nhau
  // thì chỉ ăn toạ độ theo thứ tự vào các chặng CÓ TÊN và bỏ điểm kéo — không đoán bừa.
  const aligned = pb !== null && pb.waypoints.length === segments.length
  const pbFixes = pb ? pb.waypoints.map((w) => w.fix).filter((p): p is GeoPoint => p !== null) : []
  const fixes = pbFixes.length > 0 ? pbFixes : [...raw.matchAll(LATLNG_3D4D)].map((m) => ({ lat: +m[1], lng: +m[2] }))

  let next = 0
  const stops = segments.map((seg, i): TripStop => {
    if (LATLNG_TEXT.test(seg)) return stopOf(seg)
    // Hết cặp toạ độ thì giữ lại tên, để nơi gọi nhờ HERE đoán sau.
    const fix = aligned ? pb.waypoints[i].fix : fixes[next++]
    return fix ? { lat: fix.lat, lng: fix.lng, text: seg } : { text: seg }
  })
  return {
    stops,
    vias: segments.map((_, i) => (aligned && i < segments.length - 1 ? pb.waypoints[i].vias : [])),
    avoid: pb?.avoid ?? NO_AVOID,
    googleRoute: pb?.googleRoute ?? null,
  }
}

/**
 * Khối `data=` là protobuf viết thành chữ: mỗi token `!<field><kiểu><giá trị>`, kiểu `m` là một
 * message có `<giá trị>` token con cháu theo sau. Dựng cây theo số đếm đó thì đọc theo field được,
 * khỏi đoán bằng regex. Định dạng chỉ đường (kiểm bằng link thật 2026-11-17):
 *   !4m…!4m…            khối chỉ đường
 *     !1m…              một chặng (lặp lại, đúng thứ tự; chặng là toạ độ trần thì không có 2m)
 *       !2m2!1d<lng>!2d<lat>              toạ độ chặng có tên
 *       !3m…!1m2!1d<lng>!2d<lat>!3s…      điểm kéo tuyến SAU chặng này
 *     !2m…!1b1!2b1!3b1  tránh cao tốc / thu phí / phà (phà chưa thấy trong link thật)
 *     !3e0              phương tiện (0 = ô tô)
 *     !5i1              tuyến thứ mấy đang chọn, đếm từ 0
 * Trước đây đọc mọi cặp `!1d!2d` theo thứ tự nên điểm kéo bị gán làm toạ độ chặng có tên.
 */
interface PbNode {
  field: number
  type: string
  value: string
  kids: PbNode[]
}

function pbTree(data: string): PbNode[] {
  const toks = data
    .split('!')
    .map((s) => /^(\d+)([a-zA-Z])(.*)$/.exec(s))
    .filter((m): m is RegExpExecArray => m !== null)
  let i = 0
  // Đọc tối đa `n` token (tính cả con cháu) thành danh sách node cùng cấp.
  const take = (n: number): PbNode[] => {
    const out: PbNode[] = []
    let used = 0
    while (used < n && i < toks.length) {
      const [, field, type, value] = toks[i++]
      used++
      const node: PbNode = { field: +field, type, value, kids: [] }
      if (type === 'm') {
        const start = i
        node.kids = take(parseInt(value, 10) || 0)
        used += i - start
      }
      out.push(node)
    }
    return out
  }
  return take(Infinity)
}

function kid(n: PbNode | undefined, field: number, type: string): PbNode | undefined {
  return n?.kids.find((k) => k.field === field && k.type === type)
}

function pbPoint(n: PbNode | undefined): GeoPoint | null {
  const lng = parseFloat(kid(n, 1, 'd')?.value ?? '')
  const lat = parseFloat(kid(n, 2, 'd')?.value ?? '')
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

interface PbDirections {
  /** Mỗi chặng: toạ độ riêng (null nếu chặng là toạ độ trần) + điểm kéo ngay sau nó. */
  waypoints: Array<{ fix: GeoPoint | null; vias: GeoPoint[] }>
  avoid: Avoid
  googleRoute: number | null
}

function readPbDirections(raw: string): PbDirections | null {
  const data = /\/data=([^?#/]*)/.exec(raw)?.[1]
  if (!data) return null
  const outer = pbTree(data).find((n) => n.field === 4 && n.type === 'm')
  const dir = kid(outer, 4, 'm')
  if (!dir) return null
  const waypoints = dir.kids
    .filter((k) => k.field === 1 && k.type === 'm')
    .map((w) => ({
      fix: pbPoint(kid(w, 2, 'm')),
      vias: (kid(w, 3, 'm')?.kids ?? [])
        .filter((v) => v.field === 1 && v.type === 'm')
        .map(pbPoint)
        .filter((p): p is GeoPoint => p !== null),
    }))
  const opt = kid(dir, 2, 'm')
  const on = (field: number) => kid(opt, field, 'b')?.value === '1'
  const idx = parseInt(kid(dir, 5, 'i')?.value ?? '', 10)
  return {
    waypoints,
    avoid: { highway: on(1), toll: on(2), ferry: on(3) },
    googleRoute: Number.isFinite(idx) ? idx : null,
  }
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
