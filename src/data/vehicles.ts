/**
 * Thông số các mẫu ô tô điện VinFast để ước tính % pin khi đến trạm (xem battery.ts).
 *
 * `kwh` là dung lượng công bố. `kwhPer100` là mức tiêu thụ THỰC TẾ ước tính (≈ dung lượng ÷
 * (quãng đường NEDC × 0,8)), không phải số hãng công bố — NEDC lạc quan hơn đường thật nhiều.
 * `dcKw` / `acKw` là công suất tối đa xe nhận, làm tròn theo thời gian sạc 10–70% công bố.
 * Tra ngày 2026-11-17 (VinFast VN, ev-database.org, autocarindia, auto-data.net).
 */
import { pick } from '../i18n'

export interface Vehicle {
  id: string
  name: string
  /** Dung lượng pin dùng được (kWh). */
  kwh: number
  /** Tiêu thụ thực tế ước tính ở tốc độ hỗn hợp, không điều hoà (kWh/100 km). */
  kwhPer100: number
  /** Công suất sạc DC tối đa xe nhận. */
  dcKw: number
  /** Bộ sạc AC trên xe. */
  acKw: number
}

export const VEHICLES: Vehicle[] = [
  { id: 'vf3', name: 'VF 3', kwh: 18.64, kwhPer100: 11, dcKw: 30, acKw: 6.6 },
  { id: 'minio', name: 'Minio Green', kwh: 18.5, kwhPer100: 11, dcKw: 30, acKw: 6.6 },
  { id: 'vf5', name: 'VF 5 / Herio Green', kwh: 37.23, kwhPer100: 14, dcKw: 50, acKw: 7.4 },
  { id: 'vfe34', name: 'VF e34 / Nerio Green', kwh: 41.9, kwhPer100: 15, dcKw: 60, acKw: 7.4 },
  { id: 'vf6', name: 'VF 6', kwh: 59.6, kwhPer100: 15.5, dcKw: 100, acKw: 7.4 },
  { id: 'limo', name: 'Limo Green', kwh: 60.13, kwhPer100: 15.5, dcKw: 80, acKw: 7.4 },
  { id: 'vf7eco', name: 'VF 7 Eco', kwh: 59.6, kwhPer100: 16.5, dcKw: 100, acKw: 11 },
  { id: 'vf7plus', name: 'VF 7 Plus', kwh: 70.8, kwhPer100: 17.5, dcKw: 100, acKw: 11 },
  { id: 'vf8', name: 'VF 8', kwh: 87.7, kwhPer100: 19.5, dcKw: 150, acKw: 11 },
  { id: 'vf9', name: 'VF 9', kwh: 123, kwhPer100: 23, dcKw: 150, acKw: 11 },
]

/** Xe người dùng tự nhập dung lượng + tiêu thụ. */
export const CUSTOM_ID = 'custom'
export const VEHICLE_IDS = [...VEHICLES.map((v) => v.id), CUSTOM_ID]

const CUSTOM_NAME = pick({ vi: 'Tuỳ chỉnh', en: 'Custom' })

/** Xe đang chọn; null = chưa chọn. Xe tuỳ chỉnh không giới hạn công suất sạc thêm. */
export function vehicleOf(id: string | null, customKwh: number, customKwhPer100: number): Vehicle | null {
  if (id === CUSTOM_ID) return { id, name: CUSTOM_NAME, kwh: customKwh, kwhPer100: customKwhPer100, dcKw: 150, acKw: 11 }
  return VEHICLES.find((v) => v.id === id) ?? null
}
