import { useState, type PointerEvent } from 'react'
import { chargeMinutes, dcCurveKw } from '../data/battery'
import type { Vehicle } from '../data/vehicles'
import { fmtMinutes } from '@/lib/format'
import { pick } from '../i18n'

const L = pick({
  vi: {
    title: 'Đường cong sạc nhanh DC (ước tính)',
    aria: (peak: number, min: string) => `Đường cong sạc DC: đỉnh ${peak} kW, sạc 10→80% khoảng ${min} ở trụ 250 kW`,
    summary: (min: string, peak: number) => `10→80%: ~${min} ở trụ 250 kW · đỉnh ${peak} kW.`,
    note: 'Hình dạng suy luận theo loại pin, chỉnh cho khớp thời gian 10→70% hãng công bố — không phải số đo.',
    pct: 'Pin',
  },
  en: {
    title: 'DC fast-charging curve (estimate)',
    aria: (peak: number, min: string) => `DC charging curve: peak ${peak} kW, 10→80% in about ${min} on a 250 kW charger`,
    summary: (min: string, peak: number) => `10→80%: ~${min} on a 250 kW charger · peak ${peak} kW.`,
    note: "Shape inferred from the battery type and fitted to the official 10→70% time — not a measurement.",
    pct: 'Battery',
  },
})

// Khung vẽ (đơn vị viewBox); SVG co theo bề ngang khung chứa.
const W = 320
const H = 160
// Lề trên chừa chỗ chữ đơn vị "kW" (không đè số trục), lề phải chừa nửa nhãn "100%".
const PAD = { l: 34, r: 16, t: 22, b: 24 }
const PW = W - PAD.l - PAD.r
const PH = H - PAD.t - PAD.b
const X_TICKS = [0, 20, 40, 60, 80, 100]

/**
 * Biểu đồ đường: công suất DC xe nhận (kW) theo % pin, từ `vehicle.dcCurve`. Dải 10→80% (vùng sạc
 * thường dùng) tô nhạt. Rê chuột / chạm để xem kW tại một mức pin.
 */
export function ChargeCurveChart({ vehicle }: { vehicle: Vehicle }) {
  const [hover, setHover] = useState<number | null>(null)

  const samples = Array.from({ length: 101 }, (_, s) => dcCurveKw(vehicle, s))
  const peak = Math.round(Math.max(...samples))
  const yMax = Math.max(50, Math.ceil(peak / 50) * 50)
  const yTicks = Array.from({ length: yMax / 50 + 1 }, (_, i) => i * 50).filter((v, _i, a) => a.length <= 5 || v % 100 === 0)
  const x = (soc: number) => PAD.l + (soc / 100) * PW
  const y = (kw: number) => PAD.t + PH - (kw / yMax) * PH
  const path = samples.map((kw, s) => `${s ? 'L' : 'M'}${x(s).toFixed(1)},${y(kw).toFixed(1)}`).join('')
  const min1080 = fmtMinutes((chargeMinutes(10, { kw: 250, dc: true }, vehicle, 80) ?? 0) * 60)

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const soc = Math.round((((e.clientX - r.left) / r.width) * W - PAD.l) / (PW / 100))
    setHover(soc >= 0 && soc <= 100 ? soc : null)
  }

  const hKw = hover === null ? 0 : dcCurveKw(vehicle, hover)
  const tipLeft = hover !== null && hover > 60 // chú thích lật sang trái khi gần mép phải

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-xs font-medium text-muted-foreground">{L.title}</figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-pan-y select-none"
          role="img"
          aria-label={L.aria(peak, min1080)}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {/* Dải 10→80% */}
          <rect x={x(10)} y={PAD.t} width={x(80) - x(10)} height={PH} className="fill-brand/8" />
          {/* Lưới + trục: mờ, không tranh với đường dữ liệu */}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
              <text x={PAD.l - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[10px] tabular-nums">
                {v}
              </text>
            </g>
          ))}
          {X_TICKS.map((s) => (
            <text key={s} x={x(s)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">
              {s}%
            </text>
          ))}
          <text x={PAD.l - 6} y={4} textAnchor="end" className="fill-muted-foreground text-[10px]" dominantBaseline="hanging">
            kW
          </text>
          {/* Đường dữ liệu: 2px, màu brand */}
          <path d={path} fill="none" className="stroke-brand" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* Con trỏ dọc + điểm */}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + PH} className="stroke-muted-foreground/60" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(hKw)} r={4.5} className="fill-brand stroke-card" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg bg-popover px-2 py-1 text-xs shadow-md ring-1 ring-border"
            style={tipLeft ? { right: `${100 - (x(hover) / W) * 100 + 2}%` } : { left: `${(x(hover) / W) * 100 + 2}%` }}
          >
            <span className="text-muted-foreground">{L.pct} {hover}% · </span>
            <span className="font-semibold tabular-nums">{Math.round(hKw)} kW</span>
          </div>
        )}
      </div>
      <p className="text-xs text-foreground">{L.summary(min1080, peak)}</p>
      <p className="text-[11px] text-muted-foreground">{L.note}</p>
    </figure>
  )
}
