/** Toạ độ, khoảng cách và vị trí GPS dùng chung cho cả app. */

export interface GeoPoint {
  lat: number
  lng: number
}

/** km mỗi độ vĩ (trung bình) và mỗi độ kinh ở xích đạo — nhân thêm cos(lat) cho kinh độ. */
export const KM_PER_LAT = 110.574
export const KM_PER_LNG = 111.32

export const toRad = (deg: number) => (deg * Math.PI) / 180

/** km mỗi độ kinh tại vĩ độ `lat`. */
export const kmPerLng = (lat: number) => KM_PER_LNG * Math.cos(toRad(lat))

/** Khoảng cách Haversine (km). */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export type GpsResult = 'ok' | 'denied' | 'failed'

/**
 * Hỏi vị trí một lần (tối đa 10 s, chấp nhận bản ≤ 1 phút). Không có API / bị từ chối / lỗi thì
 * `pos` null kèm lý do. Theo dõi liên tục trên bản đồ là việc của GeolocateControl (MapView).
 */
export function getPosition(highAccuracy = false): Promise<{ pos: GeoPoint | null; result: GpsResult }> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return Promise.resolve({ pos: null, result: 'failed' })
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ pos: { lat: p.coords.latitude, lng: p.coords.longitude }, result: 'ok' }),
      (e) => resolve({ pos: null, result: e.code === e.PERMISSION_DENIED ? 'denied' : 'failed' }),
      { enableHighAccuracy: highAccuracy, timeout: 10_000, maximumAge: 60_000 },
    ),
  )
}
