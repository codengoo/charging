import { useState } from 'react'
import { PinPreview } from './groupIcons'
import { TIER_COLORS } from '../map/pins'
import { FAST_KW } from '../data/stations'

const KEY = 'tramsac.legend'

const ROWS = [
  { color: TIER_COLORS[0], label: 'AC / chưa rõ' },
  { color: TIER_COLORS[1], label: `DC < ${FAST_KW} kW` },
  { color: TIER_COLORS[2], label: `DC ≥ ${FAST_KW} kW` },
]

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
      aria-label={open ? 'Thu chú giải màu ghim' : 'Mở chú giải màu ghim'}
      className="absolute right-3 bottom-14 z-[5] rounded-xl bg-card/90 text-left shadow-lg shadow-black/10 backdrop-blur outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      {open ? (
        <span className="flex flex-col gap-1.5 px-3 py-2.5 text-[13px] leading-none">
          {ROWS.map((r) => (
            <span key={r.label} className="flex items-center gap-2">
              <PinPreview group={{ iconKey: 'charger', colorHex: r.color }} width={22} />
              {r.label}
            </span>
          ))}
          <span className="flex items-center gap-2 text-muted-foreground">
            <PinPreview group={{ iconKey: 'charger', colorHex: TIER_COLORS[0] }} width={22} className="opacity-45" />
            Bảo trì / sắp mở
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
