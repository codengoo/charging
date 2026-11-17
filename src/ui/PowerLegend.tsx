import { useState } from 'react'
import { CHARGER_GLYPH, TIER_COLORS, darkenHex, tintHex } from '../map/pins'
import { FAST_KW } from '../data/stations'
import { pick } from '../i18n'

const KEY = 'tramsac.legend'

const L = pick({
  vi: {
    ac: 'AC / chưa rõ',
    collapse: 'Thu chú giải màu ghim',
    expand: 'Mở chú giải màu ghim',
    inactive: 'Bảo trì / sắp mở',
  },
  en: {
    ac: 'AC / unknown',
    collapse: 'Collapse pin color legend',
    expand: 'Expand pin color legend',
    inactive: 'Maintenance / opening soon',
  },
})

const ROWS = [
  { color: TIER_COLORS[0], label: L.ac },
  { color: TIER_COLORS[1], label: `DC < ${FAST_KW} kW` },
  { color: TIER_COLORS[2], label: `DC ≥ ${FAST_KW} kW` },
]

/** Đĩa màu + phích cắm y như lòng ghim trên bản đồ, bỏ vỏ ghim trắng bên ngoài. */
function ChargerDot({ color, className }: { color: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="-3.5 -3.5 31 31" className={`size-5 shrink-0 ${className ?? ''}`}>
      <circle cx="12" cy="12" r="15.5" fill={tintHex(color)} />
      <path d={CHARGER_GLYPH} fill={darkenHex(color)} fillRule="evenodd" />
    </svg>
  )
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'closed'
  } catch {
    return true
  }
}

/**
 * Chú giải màu ghim, góc dưới phải. Bấm để thu thành chấm nhỏ; nhớ lựa chọn trong localStorage
 * (chế độ riêng tư không đọc được thì cứ mở — chỉ là tiện ích hiển thị).
 */
export function PowerLegend() {
  const [open, setOpen] = useState(readOpen)

  function toggle() {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(KEY, next ? 'open' : 'closed')
    } catch {
      // bỏ qua
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-label={open ? L.collapse : L.expand}
      className="absolute right-3 bottom-14 z-[5] rounded-xl bg-card/90 text-left shadow-lg shadow-black/10 backdrop-blur outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      {open ? (
        <span className="flex flex-col gap-2 px-3 py-2.5 text-[13px] leading-none">
          {ROWS.map((r) => (
            <span key={r.label} className="flex items-center gap-2">
              <ChargerDot color={r.color} />
              {r.label}
            </span>
          ))}
          <span className="flex items-center gap-2 text-muted-foreground">
            <ChargerDot color={TIER_COLORS[0]} className="opacity-45" />
            {L.inactive}
          </span>
        </span>
      ) : (
        <span className="flex gap-1 p-2.5" aria-hidden>
          {TIER_COLORS.map((c) => (
            <span key={c} className="size-3.5 rounded-full" style={{ background: c }} />
          ))}
        </span>
      )}
    </button>
  )
}
