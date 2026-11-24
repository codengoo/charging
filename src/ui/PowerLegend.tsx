import { useState } from 'react'
import { TIER_COLORS } from '../map/pins'
import { ChargerDot } from './ChargerDot'
import { FAST_KW } from '../data/stations'
import { pick } from '../i18n'
import { readStr, writeStr } from '@/lib/storage'

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

const readOpen = (): boolean => readStr(KEY) !== 'closed'

/**
 * Chú giải màu ghim, góc dưới phải (MapView đặt vị trí, xếp trên nút định vị). Bấm để thu thành chấm nhỏ; nhớ lựa chọn trong localStorage
 * (chế độ riêng tư không đọc được thì cứ mở — chỉ là tiện ích hiển thị).
 */
export function PowerLegend() {
  const [open, setOpen] = useState(readOpen)

  function toggle() {
    const next = !open
    setOpen(next)
    writeStr(KEY, next ? 'open' : 'closed')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-label={open ? L.collapse : L.expand}
      className="rounded-xl bg-card/90 text-left shadow-lg shadow-black/10 backdrop-blur outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
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
            <ChargerDot color={TIER_COLORS[0]} className="size-5 opacity-45" />
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
