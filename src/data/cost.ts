/**
 * Ước tính tiền sạc từ giá điện mỗi kWh người dùng đặt (Settings.pricePerKwh). Tính ở client,
 * không gọi API. Trụ tính tiền theo điện năng XUẤT RA, pin chỉ nhận được phần lớn trong đó (hao hụt
 * khi sạc) — nên kWh tính tiền = kWh vào pin ÷ CHARGE_EFFICIENCY.
 */
import { LANG } from '../i18n'
import type { Vehicle } from './vehicles'

/**
 * Giá sạc mặc định (đ/kWh, gồm VAT) — giá niêm yết trạm VinFast / V-GREEN tham khảo, tra 2026-11.
 * Người dùng sửa trong Xe của bạn; 0 = được sạc miễn phí (ẩn chi phí).
 */
export const DEFAULT_PRICE = 3858
export const PRICE_MAX = 20000
/** Pin nhận ~92% điện năng trụ xuất ra (hao hụt bộ sạc, làm mát pin). */
export const CHARGE_EFFICIENCY = 0.92

/** kWh trụ tính tiền khi sạc từ `fromPct` lên `toPct`; không cần sạc → 0. */
export function billedKwh(fromPct: number, toPct: number, v: Pick<Vehicle, 'kwh'>): number {
  const pct = Math.max(0, toPct - Math.max(0, fromPct))
  return ((pct / 100) * v.kwh) / CHARGE_EFFICIENCY
}

/** Tiền sạc (đ); giá ≤ 0 (miễn phí / chưa đặt) → null để giao diện ẩn đi. */
export function chargeCost(fromPct: number, toPct: number, v: Pick<Vehicle, 'kwh'>, pricePerKwh: number): number | null {
  if (!(pricePerKwh > 0)) return null
  return billedKwh(fromPct, toPct, v) * pricePerKwh
}

/** "~85.000 đ" / "~85,000 VND" — làm tròn tới 1.000 đ (dưới 1.000 thì tới 100 đ). */
export function fmtVnd(vnd: number): string {
  const step = vnd < 1000 ? 100 : 1000
  const v = Math.max(step, Math.round(vnd / step) * step)
  return LANG === 'en' ? `~${v.toLocaleString('en-US')} VND` : `~${v.toLocaleString('vi-VN')} đ`
}
