import { BatteryMedium, ChevronRight, Zap } from 'lucide-react'
import {
  DEFAULT_PCT,
  arrivalPct,
  avgKmh,
  chargeMinutes,
  chargePort,
  type ArrivalEstimate,
  type BatteryReading,
} from '../data/battery'
import { fmtMinutes, type DriveState } from '../data/drive'
import type { LivePorts } from '../data/live'
import type { StationPower } from '../data/types'
import type { Vehicle } from '../data/vehicles'
import { fmtKw } from '@/lib/format'
import { LOCALE, pick } from '@/i18n'

const L = pick({
  vi: {
    battery: 'Pin hiện tại',
    start: 'Xuất phát với',
    drag: 'kéo để nhập',
    staleAt: (t: string) => `nhập lúc ${t} — kéo để cập nhật`,
    left: 'Còn ',
    onArrival: ' khi tới',
    cantReach: 'Có thể không tới được',
    charge: (kw: string, m: string) => `Sạc lên 80% ở cổng ${kw} kW: ~${m}`,
    computing: 'Đang tính quãng đường…',
    needGps: 'Bật định vị để ước tính pin khi tới.',
    pickCar: 'Ước tính pin khi tới — chọn xe',
    note: (car: string) => `Ước tính cho ${car}, chưa tính độ dốc.`,
  },
  en: {
    battery: 'Current battery',
    start: 'Starting with',
    drag: 'drag to set',
    staleAt: (t: string) => `set at ${t} — drag to update`,
    left: '',
    onArrival: ' left on arrival',
    cantReach: 'You may not make it',
    charge: (kw: string, m: string) => `Charge to 80% at ${kw} kW: ~${m}`,
    computing: 'Calculating distance…',
    needGps: 'Turn on location to estimate battery on arrival.',
    pickCar: 'Estimate battery on arrival — pick your car',
    note: (car: string) => `Estimate for ${car}, terrain not included.`,
  },
})

const clock = (t: number) => new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })

/** Màu chữ theo % pin bi quan khi đến: dưới 5% đỏ, dưới 15% cam. */
export function pctTone(low: number): string {
  if (low < 5) return 'text-destructive'
  if (low < 15) return 'text-[#B45309] dark:text-[#F0A500]'
  return 'text-foreground'
}

/** "~38–45%"; hai đầu trùng thì một số. Âm kẹp về 0. */
export function fmtRange({ low, high }: ArrivalEstimate): string {
  const lo = Math.max(0, Math.round(low))
  const hi = Math.max(0, Math.round(high))
  return lo === hi ? `~${lo}%` : `~${lo}–${hi}%`
}

/** % pin đang dùng để tính: đã nhập thì theo đó, chưa thì mặc định 80%. */
export const pctOf = (r: BatteryReading | null) => r?.pct ?? DEFAULT_PCT

/** Thanh trượt % pin hiện tại. Kéo là lưu ngay (localStorage). */
export function BatteryControl({
  reading,
  stale,
  onChange,
  compact,
}: {
  reading: BatteryReading | null
  stale: boolean
  onChange: (pct: number) => void
  /** Dọc đường: nhãn "Xuất phát với". */
  compact?: boolean
}) {
  const pct = pctOf(reading)
  const hint = !reading ? L.drag : stale ? L.staleAt(clock(reading.at)) : null
  const label = compact ? L.start : L.battery
  return (
    <div data-vaul-no-drag className="flex flex-col gap-0.5">
      <label className="flex items-center gap-2 text-sm">
        <BatteryMedium className="size-4 shrink-0 text-brand" aria-hidden />
        <span className="shrink-0">{label}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="h-6 min-w-0 flex-1 cursor-pointer accent-brand"
        />
        <span className={`w-10 shrink-0 text-right font-semibold tabular-nums ${reading && !stale ? '' : 'text-muted-foreground'}`}>
          {pct}%
        </span>
      </label>
      {hint && (
        <span className={`pl-6 text-xs ${stale ? 'text-[#B45309] dark:text-[#F0A500]' : 'text-muted-foreground'}`}>{hint}</span>
      )}
    </div>
  )
}

/** Đường chim bay → đường lái ~1,3 lần (đường VN vòng vèo), tốc độ hỗn hợp. */
const DETOUR = 1.3

/**
 * Hộp "pin khi tới" trong bảng trạm: thanh trượt, % ước tính khi đến, thời gian sạc lên 80%.
 * Chưa chọn xe → chỉ một link mở Cài đặt.
 */
export function BatteryBox({
  vehicle,
  climate,
  reading,
  stale,
  onBattery,
  drive,
  power,
  live,
  onOpenSettings,
}: {
  vehicle: Vehicle | null
  climate: boolean
  reading: BatteryReading | null
  stale: boolean
  onBattery: (pct: number) => void
  drive?: DriveState
  power?: StationPower
  live: LivePorts[] | null
  onOpenSettings: () => void
}) {
  if (!vehicle) {
    return (
      <button
        type="button"
        onClick={onOpenSettings}
        className="mt-2 flex items-center gap-1.5 self-start text-sm text-brand hover:underline"
      >
        <BatteryMedium className="size-4 shrink-0" aria-hidden />
        {L.pickCar}
        <ChevronRight className="size-4" aria-hidden />
      </button>
    )
  }

  const pct = pctOf(reading)
  let est: ArrivalEstimate | null = null
  if (drive?.kind === 'ok') est = arrivalPct(pct, drive.info.meters / 1000, avgKmh(drive.info.meters, drive.info.seconds), vehicle, climate)
  else if (drive?.kind === 'fallback') est = arrivalPct(pct, drive.straightKm * DETOUR, 50, vehicle, climate)

  const port = chargePort(power, live)
  const minutes = est && port && est.high >= 0 ? chargeMinutes((est.low + est.high) / 2, port, vehicle) : null

  return (
    <section className="mt-2 flex flex-col gap-1.5 rounded-xl bg-muted px-3 py-2.5" aria-label={L.battery}>
      <BatteryControl reading={reading} stale={stale} onChange={onBattery} />
      {(!drive || drive.kind === 'none') && <p className="pl-6 text-xs text-muted-foreground">{L.needGps}</p>}
      {drive?.kind === 'loading' && <p className="pl-6 text-xs text-muted-foreground">{L.computing}</p>}
      {est && (
        <p className={`pl-6 text-sm ${pctTone(est.low)}`}>
          {est.high < 0 ? (
            <span className="font-semibold">{L.cantReach}</span>
          ) : (
            <>
              {L.left}
              <span className="font-semibold tabular-nums">{fmtRange(est)}</span>
              {L.onArrival}
              {est.low < 0 && ` · ${L.cantReach.toLowerCase()}`}
            </>
          )}
        </p>
      )}
      {minutes !== null && port && (
        <p className="flex items-center gap-1 pl-6 text-sm text-muted-foreground">
          <Zap className="-ml-0.5 size-3.5 shrink-0" aria-hidden />
          {L.charge(fmtKw(port.kw), fmtMinutes(minutes * 60))}
        </p>
      )}
      {est && <p className="pl-6 text-[11px] text-muted-foreground">{L.note(vehicle.name)}</p>}
    </section>
  )
}
