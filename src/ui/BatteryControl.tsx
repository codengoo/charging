import { BatteryMedium, ChevronRight, Zap } from 'lucide-react'
import {
  DEFAULT_PCT,
  FALLBACK_KMH,
  ROAD_DETOUR,
  TARGET_PCT,
  arrivalPct,
  avgKmh,
  chargeMinutes,
  chargePort,
  type ArrivalEstimate,
  type BatteryReading,
} from '../data/battery'
import { chargeCost, fmtVnd } from '../data/cost'
import type { DriveState } from '../data/drive'
import type { LivePorts } from '../data/live'
import type { StationPower } from '../data/types'
import type { Vehicle } from '../data/vehicles'
import { fmtKw } from '@/lib/format'
import { Slider } from '@/components/ui/slider'
import { LOCALE, pick } from '@/i18n'
import { fmtMinutes } from '@/lib/format'

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

/** Dưới mức này (ước tính bi quan) là dễ hết pin: chữ đỏ, và Dọc đường tô nền đỏ từ trạm đầu tiên như vậy. */
export const DANGER_PCT = 5

/** Màu chữ theo % pin bi quan khi đến: dưới DANGER_PCT đỏ, dưới 15% cam. */
export function pctTone(low: number): string {
  if (low < DANGER_PCT) return 'text-destructive'
  if (low < 15) return 'text-warn'
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
      <div className="flex items-center gap-2 text-sm">
        <BatteryMedium className="size-4 shrink-0 text-brand" aria-hidden />
        <span className="shrink-0">{label}</span>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[pct]}
          onValueChange={([v]) => onChange(v)}
          thumbLabel={label}
          className="h-6 min-w-0 flex-1"
        />
        <span className={`w-10 shrink-0 text-right font-semibold tabular-nums ${reading && !stale ? '' : 'text-muted-foreground'}`}>
          {pct}%
        </span>
      </div>
      {hint && (
        <span className={`pl-6 text-xs ${stale ? 'text-warn' : 'text-muted-foreground'}`}>{hint}</span>
      )}
    </div>
  )
}

/**
 * Hộp "pin khi tới" trong bảng trạm: thanh trượt, % ước tính khi đến, thời gian sạc lên 80%.
 * Chưa chọn xe → chỉ một link mở drawer chọn xe.
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
  onPickCar,
  pricePerKwh,
}: {
  vehicle: Vehicle | null
  climate: boolean
  /** Giá sạc đ/kWh (Settings); 0 = miễn phí → không hiện tiền. */
  pricePerKwh: number
  reading: BatteryReading | null
  stale: boolean
  onBattery: (pct: number) => void
  drive?: DriveState
  power?: StationPower
  live: LivePorts[] | null
  onPickCar: () => void
}) {
  if (!vehicle) {
    return (
      <button
        type="button"
        onClick={onPickCar}
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
  else if (drive?.kind === 'fallback') est = arrivalPct(pct, drive.straightKm * ROAD_DETOUR, FALLBACK_KMH, vehicle, climate)

  const port = chargePort(power, live)
  const mid = est ? (est.low + est.high) / 2 : 0
  const minutes = est && port && est.high >= 0 ? chargeMinutes(mid, port, vehicle) : null
  const cost = minutes !== null ? chargeCost(mid, TARGET_PCT, vehicle, pricePerKwh) : null

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
          {cost !== null && ` · ${fmtVnd(cost)}`}
        </p>
      )}
      {est && <p className="pl-6 text-[11px] text-muted-foreground">{L.note(vehicle.name)}</p>}
    </section>
  )
}
