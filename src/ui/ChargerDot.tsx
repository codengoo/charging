import { CHARGER_GLYPH, darkenHex, tintHex } from '../map/pins'

/**
 * Đĩa màu + phích cắm y như lòng ghim trên bản đồ, bỏ vỏ ghim trắng bên ngoài. Dùng ở chú giải
 * màu và danh sách trạm. Cỡ mặc định size-5; `className` (vd. "size-8") thay hẳn cỡ mặc định.
 */
export function ChargerDot({ color, className = 'size-5' }: { color: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="-3.5 -3.5 31 31" className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="15.5" fill={tintHex(color)} />
      <path d={CHARGER_GLYPH} fill={darkenHex(color)} fillRule="evenodd" />
    </svg>
  )
}
