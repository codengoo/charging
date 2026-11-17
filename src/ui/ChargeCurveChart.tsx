import { useState, type PointerEvent } from 'react'
import { chargeMinutes, dcCurveKw } from '../data/battery'
import type { Vehicle } from '../data/vehicles'
import { fmtMinutes } from '@/lib/format'
import { Segmented } from '@/components/ui/segmented'
import { pick } from '../i18n'

const L = pick({
  vi: {
    title: 'Đường cong sạc nhanh DC (ước tính)',
    aria: (peak: number, min: string, st: number) => `Đường cong sạc DC: xe nhận tối đa ${peak} kW, sạc 10→80% khoảng ${min} ở trụ ${st} kW`,
    summary: (min: string, st: number, peak: number) => `10→80%: ~${min} ở trụ ${st} kW · xe nhận tối đa ${peak} kW.`,
    station: 'Công suất trụ',
    capped: (st: number) => `Trụ ${st} kW: phần trên ${st} kW bị cắt bằng.`,
    note: 'Hình dạng suy luận theo loại pin, chỉnh cho khớp thời gian 10→70% hãng công bố — không phải số đo.',
    pct: 'Pin',
  },
  en: {
    title: 'DC fast-charging curve (estimate)',
    aria: (peak: number, min: string, st: number) => `DC charging curve: car takes up to ${peak} kW, 10→80% in about ${min} on a ${st} kW charger`,
    summary: (min: string, st: number, peak: number) => `10→80%: ~${min} on a ${st} kW charger · car takes up to ${peak} kW.`,
    station: 'Charger power',
    capped: (st: number) => `${st} kW charger: everything above ${st} kW is flattened.`,
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
/** Các mức trụ phổ biến của VinFast để so. */
const STATIONS = [60, 120, 250] as const
type StationKw = (typeof STATIONS)[number]

/**
 * Biểu đồ đường: công suất DC xe nhận (kW) theo % pin, từ `vehicle.dcCurve`, ở một mức trụ chọn được
 * (60 / 120 / 250 kW): nét liền = thực nhận min(đường cong, trụ), nét đứt mờ = đường cong của xe khi
 * trụ thấp hơn. Dải 10→80% (vùng sạc thường dùng) tô nhạt. Rê chuột / chạm để xem kW tại một mức pin.
 */
export function ChargeCurveChart({ vehicle }: { vehicle: Vehicle }) {
  const [hover, setHover] = useState<number | null>(null)
  const [station, setStation] = useState<StationKw>(250)

  // Lấy mẫu dày (0,5%) cho đường mượt; trục y theo đường cong của xe để đổi trụ không làm nhảy trục.
  const samples = Array.from({ length: 201 }, (_, i) => dcCurveKw(vehicle, i / 2))
  const peak = Math.round(Math.max(...samples))
  const capped = station < peak
  const yMax = Math.max(50, Math.ceil(peak / 50) * 50)
  const yTicks = Array.from({ length: yMax / 50 + 1 }, (_, i) => i * 50).filter((v, _i, a) => a.length <= 5 || v % 100 === 0)
  const x = (soc: number) => PAD.l + (soc / 100) * PW
  const y = (kw: number) => PAD.t + PH - (kw / yMax) * PH
  const pathOf = (cap: number) => samples.map((kw, i) => `${i ? 'L' : 'M'}${x(i / 2).toFixed(1)},${y(Math.min(kw, cap)).toFixed(1)}`).join('')
  const min1080 = fmtMinutes((chargeMinutes(10, { kw: station, dc: true }, vehicle, 80) ?? 0) * 60)

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const soc = Math.round((((e.clientX - r.left) / r.width) * W - PAD.l) / (PW / 100))
    setHover(soc >= 0 && soc <= 100 ? soc : null)
  }

  const hKw = hover === null ? 0 : Math.min(station, dcCurveKw(vehicle, hover))
  const tipLeft = hover !== null && hover > 60 // chú thích lật sang trái khi gần mép phải

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-xs font-medium text-muted-foreground">{L.title}</figcaption>
      <Segmented
        label={L.station}
        value={String(station)}
        onChange={(v) => setStation(Number(v) as StationKw)}
        options={STATIONS.map((kw) => ({ value: String(kw), label: `${kw} kW` }))}
      />
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-pan-y select-none"
          role="img"
          aria-label={L.aria(peak, min1080, station)}
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
          {/* Trụ thấp hơn đỉnh xe: đường cong gốc nét đứt mờ + vạch giới hạn trụ. */}
          {capped && (
            <>
              <path d={pathOf(Infinity)} fill="none" className="stroke-muted-foreground/50" strokeWidth={1.5} strokeDasharray="4 3" />
              <line x1={PAD.l} x2={W - PAD.r} y1={y(station)} y2={y(station)} className="stroke-muted-foreground/40" strokeWidth={1} strokeDasharray="2 3" />
            </>
          )}
          {/* Thực nhận ở trụ đang chọn: 2px, màu brand */}
          <path d={pathOf(station)} fill="none" className="stroke-brand" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
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
      <p className="text-xs text-foreground">
        {L.summary(min1080, station, peak)}
        {capped && <span className="text-muted-foreground"> {L.capped(station)}</span>}
      </p>
      <p className="text-[11px] text-muted-foreground">{L.note}</p>
    </figure>
  )
}
