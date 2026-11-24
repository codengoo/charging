/**
 * Thông số các mẫu ô tô điện VinFast để ước tính % pin khi đến trạm (xem battery.ts).
 *
 * `kwh` là dung lượng công bố. `kwhPer100` là mức tiêu thụ THỰC TẾ ước tính (≈ dung lượng ÷
 * (quãng đường NEDC × 0,8)), không phải số hãng công bố — NEDC lạc quan hơn đường thật nhiều.
 * `dcKw` / `acKw` là công suất tối đa xe nhận, làm tròn theo thời gian sạc 10–70% công bố.
 * Tra ngày 2026-11-17 (VinFast VN, ev-database.org, autocarindia, auto-data.net).
 *
 * `dcCurve`: công suất DC xe nhận theo % pin, nội suy tuyến tính. VinFast không công bố đường cong;
 * hình dạng là SUY LUẬN theo loại pin (LFP nhỏ gần phẳng tới 70%; NMC lớn đỉnh ở 20% rồi giảm dần),
 * rồi co cho tích phân 10→70% khớp thời gian hãng công bố (2026-11-17): VF 3 36′, Minio ~30′, VF 5 30′ /
 * Herio 33′ (lấy 32′), Nerio 27′, VF 6 25′, Limo 30′, VF 7 Eco <25′, VF 7 Plus 28′ (vinfastauto.ph),
 * VF 8 31′ và VF 9 35′ (spec sheet vinfastauto.us). Đối chiếu: VF 8 đo thật đỉnh ~110 kW, 10→80% 44,5′
 * (evkx); VF 9 giới hạn 160 kW (autotrader.ca). Phần trên 80% thuần ước lượng.
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
  /**
   * Khối lượng bản thân (kg), làm tròn, gần đúng ±5% — chỉ dùng tính năng lượng leo dốc
   * (elevation.ts), sai vài phần trăm không đáng kể so với các ước lượng khác. Không phải số hãng
   * công bố cho từng phiên bản.
   */
  massKg: number
  /** Đường cong sạc DC: [% pin, kW] tăng dần theo %. Thiếu → phẳng 75% `dcKw` (xem dcCurveOf). */
  dcCurve?: readonly (readonly [number, number])[]
}

export const VEHICLES: Vehicle[] = [
  { id: 'vf3', name: 'VF 3', kwh: 18.64, kwhPer100: 11, dcKw: 30, acKw: 6.6, massKg: 1190, dcCurve: [[0, 13], [10, 17], [20, 19], [50, 19], [70, 18], [80, 15], [90, 9], [95, 5], [100, 2]] },
  { id: 'minio', name: 'Minio Green', kwh: 18.5, kwhPer100: 11, dcKw: 30, acKw: 6.6, massKg: 1190, dcCurve: [[0, 16], [10, 20], [20, 23], [50, 23], [70, 21], [80, 18], [90, 10], [95, 6], [100, 2]] },
  { id: 'vf5', name: 'VF 5 / Herio Green', kwh: 37.23, kwhPer100: 14, dcKw: 50, acKw: 7.4, massKg: 1360, dcCurve: [[0, 26], [10, 37], [20, 43], [50, 43], [60, 41], [70, 37], [80, 28], [90, 15], [95, 9], [100, 3]] },
  { id: 'vfe34', name: 'VF e34 / Nerio Green', kwh: 41.9, kwhPer100: 15, dcKw: 60, acKw: 7.4, massKg: 1490, dcCurve: [[0, 37], [10, 52], [20, 61], [40, 61], [50, 56], [60, 50], [70, 43], [80, 31], [90, 18], [100, 6]] },
  { id: 'vf6', name: 'VF 6', kwh: 59.6, kwhPer100: 15.5, dcKw: 100, acKw: 7.4, massKg: 1750, dcCurve: [[0, 55], [10, 83], [20, 92], [45, 92], [50, 88], [60, 78], [70, 66], [80, 51], [90, 28], [100, 7]] },
  { id: 'limo', name: 'Limo Green', kwh: 60.13, kwhPer100: 15.5, dcKw: 80, acKw: 7.4, massKg: 1870, dcCurve: [[0, 45], [10, 64], [20, 75], [50, 75], [60, 71], [70, 64], [80, 49], [90, 26], [95, 15], [100, 6]] },
  { id: 'vf7eco', name: 'VF 7 Eco', kwh: 59.6, kwhPer100: 16.5, dcKw: 100, acKw: 11, massKg: 1880, dcCurve: [[0, 55], [10, 83], [20, 92], [45, 92], [50, 88], [60, 78], [70, 66], [80, 51], [90, 28], [100, 7]] },
  { id: 'vf7plus', name: 'VF 7 Plus', kwh: 70.8, kwhPer100: 17.5, dcKw: 100, acKw: 11, massKg: 2060, dcCurve: [[0, 59], [10, 88], [20, 98], [45, 98], [50, 93], [60, 83], [70, 71], [80, 54], [90, 29], [100, 8]] },
  { id: 'vf8', name: 'VF 8', kwh: 87.7, kwhPer100: 19.5, dcKw: 150, acKw: 11, massKg: 2530, dcCurve: [[0, 64], [10, 99], [20, 116], [40, 110], [50, 102], [60, 90], [70, 76], [80, 58], [90, 32], [100, 9]] },
  { id: 'vf9', name: 'VF 9', kwh: 123, kwhPer100: 23, dcKw: 150, acKw: 11, massKg: 2860, dcCurve: [[0, 79], [10, 122], [20, 144], [40, 137], [50, 127], [60, 112], [70, 95], [80, 72], [90, 40], [100, 12]] },
]

/** Xe người dùng tự nhập dung lượng + tiêu thụ. */
export const CUSTOM_ID = 'custom'
export const VEHICLE_IDS = [...VEHICLES.map((v) => v.id), CUSTOM_ID]

const CUSTOM_NAME = pick({ vi: 'Tuỳ chỉnh', en: 'Custom' })

/** Xe Tuỳ chỉnh: dạng NMC chung (như VF 8), đỉnh 120 kW. */
const GENERIC_CURVE_150: Vehicle['dcCurve'] = [[0, 66], [10, 102], [20, 120], [40, 114], [50, 106], [60, 93], [70, 79], [80, 60], [90, 33], [100, 9]]

/** Kiểu lái: hệ số nhân mức tiêu thụ ước tính (không áp khi đã nhập tiêu thụ thực tế). */
export type DriveStyle = 'eco' | 'normal' | 'fast'
export const DRIVE_STYLES: DriveStyle[] = ['eco', 'normal', 'fast']
export const STYLE_FACTOR: Record<DriveStyle, number> = { eco: 0.92, normal: 1, fast: 1.12 }

/** Dung lượng pin còn lại so với lúc mới (%) — pin chai sau vài năm. */
export const HEALTH_MIN = 60
export const HEALTH_OPTIONS = [100, 95, 90, 85, 80] as const

export interface VehicleOpts {
  /** % dung lượng còn lại (60–100); mặc định 100. */
  health?: number
  style?: DriveStyle
}

/**
 * Xe đang chọn; null = chưa chọn. Xe tuỳ chỉnh không giới hạn công suất sạc thêm. Mẫu có sẵn +
 * `usageOverride` (số người dùng đọc trên màn hình xe) → giữ pin / công suất sạc của mẫu, chỉ
 * thay mức tiêu thụ. `health` thu nhỏ dung lượng dùng được; `style` nhân mức tiêu thụ ƯỚC TÍNH —
 * số tiêu thụ thực tế (override) đã phản ánh cách lái nên không nhân thêm.
 */
export function vehicleOf(
  id: string | null,
  customKwh: number,
  customKwhPer100: number,
  usageOverride: number | null = null,
  opts: VehicleOpts = {},
): Vehicle | null {
  const base: Vehicle | undefined =
    id === CUSTOM_ID
      ? { id, name: CUSTOM_NAME, kwh: customKwh, kwhPer100: customKwhPer100, dcKw: 150, acKw: 11, massKg: 1800, dcCurve: GENERIC_CURVE_150 }
      : VEHICLES.find((x) => x.id === id)
  if (!base) return null
  const health = Math.min(100, Math.max(HEALTH_MIN, opts.health ?? 100))
  const style = usageOverride ? 1 : STYLE_FACTOR[opts.style ?? 'normal']
  const per100 = (usageOverride || base.kwhPer100) * style
  // Không đổi gì → trả nguyên object mẫu (so sánh tham chiếu ổn định cho useMemo).
  if (health === 100 && per100 === base.kwhPer100) return base
  return { ...base, kwh: (base.kwh * health) / 100, kwhPer100: per100 }
}
