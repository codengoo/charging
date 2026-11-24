/**
 * Tầm đi được với % pin hiện tại — vòng tròn trên bản đồ. Cùng mô hình tiêu thụ với battery.ts,
 * lấy ước tính BI QUAN (tiêu thụ +SPREAD) và luôn chừa mức pin dự phòng, tốc độ hỗn hợp (hệ số 1).
 * Bán kính trên bản đồ là đường chim bay = quãng lái ÷ ROAD_DETOUR: thực tế tuỳ đường, nên chỉ để
 * hình dung, không thay cho ước tính theo tuyến của Dọc đường.
 */
import { CLIMATE, ROAD_DETOUR, SPREAD } from './battery'
import type { Vehicle } from './vehicles'

export interface BatteryRange {
  /** Quãng LÁI tới được (km), đã chừa dự phòng. */
  roadKm: number
  /** Bán kính chim bay của vòng "đi tới được" (km). */
  oneWayKm: number
  /** Bán kính vòng "đi rồi về được" (km) — một nửa. */
  roundTripKm: number
}

export function batteryRange(
  pct: number,
  reservePct: number,
  v: Pick<Vehicle, 'kwh' | 'kwhPer100'>,
  climate: boolean,
): BatteryRange {
  const usable = (Math.max(0, pct - reservePct) / 100) * v.kwh
  const per100 = v.kwhPer100 * (climate ? CLIMATE : 1) * (1 + SPREAD)
  const roadKm = per100 > 0 ? (usable / per100) * 100 : 0
  const oneWayKm = roadKm / ROAD_DETOUR
  return { roadKm, oneWayKm, roundTripKm: oneWayKm / 2 }
}

const EARTH_KM = 6371.0088

/** Điểm cách `center` một khoảng `km` theo hướng `bearingDeg` (cầu, đủ chính xác vài trăm km). */
export function destination(center: { lat: number; lng: number }, km: number, bearingDeg: number): [number, number] {
  const d = km / EARTH_KM
  const b = (bearingDeg * Math.PI) / 180
  const la1 = (center.lat * Math.PI) / 180
  const lo1 = (center.lng * Math.PI) / 180
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b))
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2))
  return [(lo2 * 180) / Math.PI, (la2 * 180) / Math.PI]
}

/** Vòng tròn bán kính `km` quanh `center` dạng vòng toạ độ khép kín [lng, lat]. */
export function circleRing(center: { lat: number; lng: number }, km: number, steps = 96): [number, number][] {
  const ring: [number, number][] = []
  for (let i = 0; i < steps; i++) ring.push(destination(center, km, (i * 360) / steps))
  ring.push(ring[0])
  return ring
}
