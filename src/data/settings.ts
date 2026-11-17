import { useCallback, useState } from 'react'
import { DEFAULT_FILTERS, KW_BANDS, type Filters, type KwBand } from './stations'
import { TRIP_RADII, type TripRadius } from './useTrip'
import { THEME_PREFS, type ThemePref } from '../lib/theme'
import { VEHICLE_IDS } from './vehicles'

/**
 * Cấu hình hiển thị người dùng tự chọn, nhớ trong localStorage. Đây là giá trị MẶC ĐỊNH lúc mở
 * app: chip lọc trên bản đồ vẫn bật/tắt tạm thời trong phiên, không ghi đè cấu hình.
 */
export interface Settings {
  /** Mức công suất ưu tiên. Đủ 3 mức = không lọc; chip kW trên bản đồ bật sẵn theo đây. */
  kwBands: KwBand[]
  /** Chỉ hiện trạm đang hoạt động. */
  activeOnly: boolean
  /** Bề rộng hành lang mặc định của "Dọc đường". */
  tripRadiusKm: TripRadius
  /** Chú giải màu ghim góc dưới phải. */
  showLegend: boolean
  /** Sáng / tối / theo máy. index.html đọc trường này trước khi app nạp. */
  theme: ThemePref
  /** Mẫu xe (id trong VEHICLES hoặc 'custom') để ước tính % pin khi đến; null = chưa chọn. */
  vehicleId: string | null
  /** Xe tuỳ chỉnh: dung lượng pin (kWh) và tiêu thụ (kWh/100 km). */
  customKwh: number
  customKwhPer100: number
  /** Tiêu thụ thực tế người dùng đọc trên xe, đè số ước tính của mẫu có sẵn; null = dùng số mẫu. */
  usageOverride: number | null
  /** Bật điều hoà: tiêu thụ +8%. */
  climate: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  kwBands: KW_BANDS,
  activeOnly: DEFAULT_FILTERS.activeOnly,
  tripRadiusKm: 2,
  showLegend: true,
  theme: 'system',
  vehicleId: null,
  customKwh: 60,
  customKwhPer100: 16,
  usageOverride: null,
  climate: true,
}

const KEY = 'tramsac.settings'

/** Bản cũ lưu `power: 'all' | 'dc' | 'dc120'` — đổi sang mức gần nhất. */
function readBands(o: Record<string, unknown>): KwBand[] {
  if (Array.isArray(o.kwBands)) {
    const v = KW_BANDS.filter((b) => (o.kwBands as unknown[]).includes(b))
    return v.length ? v : KW_BANDS
  }
  if (o.power === 'dc120') return ['hi']
  if (o.power === 'dc') return ['hi', 'mid']
  return KW_BANDS
}

const inRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max

/** Đọc từng trường, sai kiểu thì về mặc định — bản lưu cũ / bị sửa tay không làm hỏng app. */
export function parseSettings(raw: string | null): Settings {
  let o: Record<string, unknown> = {}
  try {
    const v = raw ? JSON.parse(raw) : null
    if (v && typeof v === 'object') o = v as Record<string, unknown>
  } catch {
    // JSON hỏng → mặc định
  }
  const d = DEFAULT_SETTINGS
  return {
    kwBands: readBands(o),
    activeOnly: typeof o.activeOnly === 'boolean' ? o.activeOnly : d.activeOnly,
    tripRadiusKm: TRIP_RADII.includes(o.tripRadiusKm as TripRadius) ? (o.tripRadiusKm as TripRadius) : d.tripRadiusKm,
    showLegend: typeof o.showLegend === 'boolean' ? o.showLegend : d.showLegend,
    theme: THEME_PREFS.includes(o.theme as ThemePref) ? (o.theme as ThemePref) : d.theme,
    vehicleId: typeof o.vehicleId === 'string' && VEHICLE_IDS.includes(o.vehicleId) ? o.vehicleId : d.vehicleId,
    customKwh: inRange(o.customKwh, 5, 250) ? o.customKwh : d.customKwh,
    customKwhPer100: inRange(o.customKwhPer100, 5, 60) ? o.customKwhPer100 : d.customKwhPer100,
    usageOverride: inRange(o.usageOverride, 5, 60) ? o.usageOverride : d.usageOverride,
    climate: typeof o.climate === 'boolean' ? o.climate : d.climate,
  }
}

function load(): Settings {
  try {
    return parseSettings(localStorage.getItem(KEY))
  } catch {
    return DEFAULT_SETTINGS // chế độ riêng tư chặn localStorage
  }
}

/** Bộ lọc lúc mở app theo cấu hình. "Đã lưu" luôn tắt — đó là thao tác tạm, không phải sở thích. */
export function filtersFrom(s: Settings): Filters {
  return { ...DEFAULT_FILTERS, kw: s.kwBands, activeOnly: s.activeOnly }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load)

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // không lưu được thì vẫn áp dụng trong phiên
      }
      return next
    })
  }, [])

  return { settings, update }
}
