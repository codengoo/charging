/**
 * Kế hoạch sạc → link chỉ đường Google Maps (`dir/?api=1`) đi qua các trạm dừng, để dẫn đường thật.
 * Điểm ghé = chặng giữa của hành trình (người dùng tự thêm trên Google) + trạm dừng sạc, xếp theo
 * vị trí trên tuyến.
 */
import { KM_PER_LAT, kmPerLng, type GeoPoint } from '../lib/geo'

/** Google Maps trên điện thoại / web nhận tối đa chừng này điểm ghé (`waypoints`). */
export const MAX_WAYPOINTS = 9

const pt = (p: GeoPoint) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`

/** km trên tuyến của điểm gần `p` nhất (đo phẳng như routeCorridor). */
export function kmAlong(path: GeoPoint[], p: GeoPoint): number {
  if (path.length === 0) return 0
  const kx = kmPerLng(p.lat)
  let km = 0
  let bestKm = 0
  let best = Infinity
  for (let i = 0; i < path.length; i++) {
    if (i > 0) {
      const dx = (path[i].lng - path[i - 1].lng) * kx
      const dy = (path[i].lat - path[i - 1].lat) * KM_PER_LAT
      km += Math.sqrt(dx * dx + dy * dy)
    }
    const ex = (path[i].lng - p.lng) * kx
    const ey = (path[i].lat - p.lat) * KM_PER_LAT
    const d = ex * ex + ey * ey
    if (d < best) {
      best = d
      bestKm = km
    }
  }
  return bestKm
}

/**
 * `stops` = các chặng hành trình (đầu = điểm đi, cuối = điểm đến), `charge` = trạm dừng sạc kèm km
 * trên tuyến. Quá MAX_WAYPOINTS điểm ghé thì giữ chặng của người dùng, bớt trạm sạc ở cuối.
 */
export function planMapsLink(
  stops: GeoPoint[],
  path: GeoPoint[],
  charge: Array<GeoPoint & { atKm: number }>,
): string | null {
  if (stops.length < 2) return null
  const mids = stops.slice(1, -1).map((p) => ({ p, atKm: kmAlong(path, p), mine: true }))
  const room = Math.max(0, MAX_WAYPOINTS - mids.length)
  const charges = charge.slice(0, room).map((c) => ({ p: c, atKm: c.atKm, mine: false }))
  const via = [...mids, ...charges].sort((a, b) => a.atKm - b.atKm).slice(0, MAX_WAYPOINTS)
  const q = new URLSearchParams({
    api: '1',
    origin: pt(stops[0]),
    destination: pt(stops[stops.length - 1]),
    travelmode: 'driving',
  })
  if (via.length) q.set('waypoints', via.map((w) => pt(w.p)).join('|'))
  return `https://www.google.com/maps/dir/?${q}`
}
