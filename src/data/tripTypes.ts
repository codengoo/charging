/**
 * Kiểu của hành trình "trạm dọc đường" dùng chung giữa phần thuần (here.ts, routeCorridor.ts,
 * settings.ts) và hook useTrip — tách riêng để module thuần không phải import file hook (React).
 */
import type { GeoPoint } from '../lib/geo'

export type TripRadius = 2 | 5 | 10
export const TRIP_RADII: TripRadius[] = [2, 5, 10]

/**
 * Đường đi đầy đủ. `limited[i]`: đoạn bắt đầu từ điểm i có nằm trên đường CÓ KIỂM SOÁT LỐI RA
 * (cao tốc, functionalClass 1) không — dùng để bỏ trạm bên kia dải phân cách. Dài bằng `points`.
 */
export interface RoutePath {
  points: GeoPoint[]
  limited: boolean[]
  meters: number
  seconds: number
}
