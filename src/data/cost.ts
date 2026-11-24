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

/**
 * So với xe xăng (Settings.fuelPer100 / fuelPrice). Mặc định: xe xăng cỡ B/C đi hỗn hợp ~7 L/100 km;
 * giá xăng RON 95 tham khảo — người dùng sửa trong Xe của bạn.
 */
export const DEFAULT_FUEL_PER100 = 7
export const FUEL_PER100_MIN = 2
export const FUEL_PER100_MAX = 30
export const DEFAULT_FUEL_PRICE = 21000
export const FUEL_PRICE_MAX = 100000

/**
 * Chi phí năng lượng CẢ CHUYẾN (gồm phần pin có sẵn lúc xuất phát — không chỉ tiền sạc dọc đường)
 * so với xe xăng cùng quãng. `kwh` = điện năng xe dùng (giữa khoảng ước tính, đã gồm độ dốc).
 * Giá ≤ 0 → null (miễn phí / không so).
 */
export function tripCosts(
  kwh: number,
  km: number,
  o: { pricePerKwh: number; fuelPer100: number; fuelPrice: number },
): { ev: number | null; fuel: number | null } {
  const ev = o.pricePerKwh > 0 ? (Math.max(0, kwh) / CHARGE_EFFICIENCY) * o.pricePerKwh : null
  const fuel = o.fuelPrice > 0 && o.fuelPer100 > 0 ? ((km * o.fuelPer100) / 100) * o.fuelPrice : null
  return { ev, fuel }
}

/** "~85.000 đ" / "~85,000 VND" — làm tròn tới 1.000 đ (dưới 1.000 thì tới 100 đ). */
export function fmtVnd(vnd: number): string {
  const step = vnd < 1000 ? 100 : 1000
  const v = Math.max(step, Math.round(vnd / step) * step)
  return LANG === 'en' ? `~${v.toLocaleString('en-US')} VND` : `~${v.toLocaleString('vi-VN')} đ`
}
