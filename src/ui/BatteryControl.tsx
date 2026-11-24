import { BatteryMedium, ChevronRight, House, Zap } from 'lucide-react'
import { distanceKm } from '@/lib/geo'
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
  type ChargePort,
  type BatteryReading,
} from '../data/battery'
import { chargeCost, fmtVnd } from '../data/cost'
import { LOAD_KG, climbKwhOf } from '../data/elevation'
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
    homeOk: (km: number, left: number) => `Về Nhà (~${km} km) vẫn còn ~${left}% — không cần sạc.`,
    homeNeed: (km: number, to: number, m: string | null) => `Về Nhà (~${km} km): sạc lên ít nhất ~${to}%${m ? ` (~${m})` : ''}.`,
    homeFar: (km: number) => `Nhà cách ~${km} km — sạc đầy cũng chưa chắc về tới.`,
    noteElev: (car: string, up: string) => `Ước tính cho ${car}, đã tính độ dốc (leo ~${up} m).`,
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
    homeOk: (km: number, left: number) => `Home (~${km} km): you'd still have ~${left}% — no charge needed.`,
    homeNeed: (km: number, to: number, m: string | null) => `Home (~${km} km): charge to at least ~${to}%${m ? ` (~${m})` : ''}.`,
    homeFar: (km: number) => `Home is ~${km} km away — even a full charge may not get you there.`,
    noteElev: (car: string, up: string) => `Estimate for ${car}, includes elevation (~${up} m of climbing).`,
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

/**
 * "Về Nhà được không?" từ trạm: quãng chim bay × ROAD_DETOUR, tốc độ hỗn hợp, ước tính bi quan. Pin khi
 * tới trạm (bi quan) đủ về Nhà còn ≥ dự phòng → không cần sạc; không thì sạc lên tối thiểu bao nhiêu.
 * Không gọi thêm API (đường thật vòng hơn / khác độ dốc — chỉ là gợi ý).
 */
export function homeAdvice(
  arrive: ArrivalEstimate,
  port: ChargePort | null,
  v: Vehicle,
  climate: boolean,
  reservePct: number,
  home: { lat: number; lng: number },
  station: { lat: number; lng: number },
): { ok: boolean; text: string } | null {
  const km = distanceKm(station.lat, station.lng, home.lat, home.lng) * ROAD_DETOUR
  if (km < 1) return null // trạm ngay cạnh Nhà
  const need = 100 - arrivalPct(100, km, FALLBACK_KMH, v, climate).low // % pin tiêu cho quãng về (bi quan)
  const kmR = Math.round(km)
  const left = arrive.low - need
  if (left >= reservePct) return { ok: true, text: L.homeOk(kmR, Math.round(left)) }
  const to = Math.ceil(need + reservePct)
  if (to > 100) return { ok: false, text: L.homeFar(kmR) }
  const mins = port ? chargeMinutes((arrive.low + arrive.high) / 2, port, v, to) : null
  return { ok: false, text: L.homeNeed(kmR, to, mins === null ? null : fmtMinutes(mins * 60)) }
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
  home,
  reservePct,
  station,
}: {
  vehicle: Vehicle | null
  climate: boolean
  /** Giá sạc đ/kWh (Settings); 0 = miễn phí → không hiện tiền. */
  pricePerKwh: number
  /** Địa điểm Nhà (đã lưu) — dòng "Về Nhà"; null = chưa đặt. */
  home: { lat: number; lng: number } | null
  reservePct: number
  /** Toạ độ trạm — quãng từ trạm về Nhà. */
  station: { lat: number; lng: number }
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
  // Độ dốc: HERE trả độ cao trên đường tới trạm → cộng năng lượng leo / trừ phần đổ dốc lấy lại.
  const info = drive?.kind === 'ok' ? drive.info : null
  const climb = info?.upM !== undefined ? climbKwhOf(info.upM, info.downM ?? 0, vehicle.massKg + LOAD_KG) : 0
  if (info) est = arrivalPct(pct, info.meters / 1000, avgKmh(info.meters, info.seconds), vehicle, climate, climb)
  else if (drive?.kind === 'fallback') est = arrivalPct(pct, drive.straightKm * ROAD_DETOUR, FALLBACK_KMH, vehicle, climate)

  const port = chargePort(power, live)
  const mid = est ? (est.low + est.high) / 2 : 0
  const minutes = est && port && est.high >= 0 ? chargeMinutes(mid, port, vehicle) : null
  const cost = minutes !== null ? chargeCost(mid, TARGET_PCT, vehicle, pricePerKwh) : null
  const homeLine = est && home ? homeAdvice(est, port, vehicle, climate, reservePct, home, station) : null

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
      {homeLine && (
        <p className={`flex items-start gap-1 pl-6 text-sm ${homeLine.ok ? 'text-muted-foreground' : 'text-warn'}`}>
          <House className="-ml-0.5 mt-0.5 size-3.5 shrink-0" aria-hidden />
          {homeLine.text}
        </p>
      )}
      {minutes !== null && port && (
        <p className="flex items-center gap-1 pl-6 text-sm text-muted-foreground">
          <Zap className="-ml-0.5 size-3.5 shrink-0" aria-hidden />
          {L.charge(fmtKw(port.kw), fmtMinutes(minutes * 60))}
          {cost !== null && ` · ${fmtVnd(cost)}`}
        </p>
      )}
      {est && (
        <p className="pl-6 text-[11px] text-muted-foreground">
          {info?.upM !== undefined
            ? L.noteElev(vehicle.name, (Math.round(info.upM / 10) * 10).toLocaleString(LOCALE))
            : L.note(vehicle.name)}
        </p>
      )}
    </section>
  )
}
