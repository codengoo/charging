import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { ChevronUp, ClipboardPaste, Loader2, Route, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { fmtDistance, fmtKw } from '@/lib/format'
import type { RouteHits } from '../data/routeCorridor'
import { TRIP_RADII, type TripRadius, type TripState } from '../data/useTrip'
import type { Station, StationPower } from '../data/types'
import { KW_BANDS, KW_BAND_LABEL, kwActive, tierOf, type KwBand } from '../data/stations'
import { TIER_COLORS } from '../map/pins'
import { pick } from '../i18n'
import { RESERVE_PCT, arrivalPct, avgKmh, type ArrivalEstimate, type BatteryReading } from '../data/battery'
import type { Vehicle } from '../data/vehicles'
import { BatteryControl, fmtRange, pctOf, pctTone } from './BatteryControl'
import { PLAN_MIN_DC_KW, type ChargePlan } from '../data/chargePlan'
import { fmtMinutes } from '../data/drive'
import type { Avoid } from '../lib/mapsLink'

const L = pick({
  vi: {
    title: 'Trạm dọc đường',
    collapse: 'Thu bảng trạm dọc đường',
    expand: 'Mở bảng trạm dọc đường',
    openPanel: 'Mở bảng',
    closeTrip: 'Đóng hành trình',
    placeholder: 'Dán link chỉ đường Google Maps',
    linkAria: 'Link Google Maps',
    paste: 'Dán từ bộ nhớ tạm',
    find: 'Tìm',
    fromRoute: 'Cách tuyến',
    power: 'Công suất',
    listAria: 'Trạm theo thứ tự trên đường',
    offRoute: (d: string) => `cách tuyến ${d}`,
    maxKw: (kw: string) => ` · tối đa ${kw} kW`,
    resolving: 'Đang đọc liên kết…',
    routing: 'Đang tính đường và tìm trạm…',
    error: 'Có lỗi xảy ra.',
    via: (n: number) => `qua ${n} điểm dừng · `,
    count: (n: number, km: number) => `${n} trạm trong ${km} km`,
    cap: (n: number) => ` (hiện ${n} trạm sát tuyến nhất)`,
    idle: 'Mở Google Maps, chỉ đường rồi bấm Chia sẻ → Trạm sạc, hoặc dán link vào đây.',
    min: (m: number) => `${m} phút`,
    hr: (h: number) => `${h} giờ`,
    hrMin: (h: number, m: number) => `${h} giờ ${m} phút`,
    lastReachable: `Trạm cuối còn kịp (còn ≥ ${RESERVE_PCT}% pin)`,
    noneReachable: (p: number) => `Với ${p}% pin, không trạm nào chắc chắn tới được (còn ≥ ${RESERVE_PCT}%)`,
    pctAria: (p: number) => `còn khoảng ${p}% pin khi tới`,
    plan: 'Lên kế hoạch sạc',
    planAria: 'Các điểm dừng sạc theo kế hoạch',
    stop: (n: number) => `Dừng ${n}`,
    stopLine: (arrive: string, to: number, charge: string | null, kw: string) =>
      `tới ${arrive}` + (charge ? ` · sạc lên ${to}% ~${charge} (${kw} kW)` : ` · ${kw} kW`),
    noStop: (arrive: string) => `Không cần dừng sạc — tới nơi còn ${arrive}.`,
    planOk: (n: number, charge: string, total: string, arrive: string) =>
      `${n} điểm dừng · sạc ~${charge} · tới nơi sau ~${total}, còn ${arrive}.`,
    planFail: (km: number) =>
      `Không đủ trạm sạc nhanh (DC ≥ ${PLAN_MIN_DC_KW} kW) sau km ${km} — thử mở rộng hành lang, bỏ lọc công suất hoặc xuất phát với nhiều pin hơn.`,
    planNote: 'Ước tính: ghé trạm xa nhất còn ≥ 10% pin, sạc lên 80% (điểm cuối sạc vừa đủ tới nơi).',
    routes: 'Tuyến đường',
    routeCard: (km: number, n: number) => `${km} km · ${n} trạm`,
    googleHint: (n: number) => `Trên Google bạn chọn tuyến thứ ${n} — chạm tuyến khớp bên dưới hoặc trên bản đồ.`,
    avoid: 'Tránh',
    avoidOpt: { toll: 'Thu phí', highway: 'Cao tốc', ferry: 'Phà' },
  },
  en: {
    title: 'Along route',
    collapse: 'Collapse along-route panel',
    expand: 'Expand along-route panel',
    openPanel: 'Expand panel',
    closeTrip: 'Close trip',
    placeholder: 'Paste a Google Maps directions link',
    linkAria: 'Google Maps link',
    paste: 'Paste from clipboard',
    find: 'Find',
    fromRoute: 'From route',
    power: 'Power',
    listAria: 'Stations in order along the route',
    offRoute: (d: string) => `${d} from route`,
    maxKw: (kw: string) => ` · up to ${kw} kW`,
    resolving: 'Reading link…',
    routing: 'Calculating route and finding stations…',
    error: 'Something went wrong.',
    via: (n: number) => `via ${n} ${n === 1 ? 'stop' : 'stops'} · `,
    count: (n: number, km: number) => `${n} ${n === 1 ? 'station' : 'stations'} within ${km} km`,
    cap: (n: number) => ` (showing ${n} closest to the route)`,
    idle: 'In Google Maps, get directions and tap Share → Trạm Sạc, or paste the link here.',
    min: (m: number) => `${m} min`,
    hr: (h: number) => `${h} h`,
    hrMin: (h: number, m: number) => `${h} h ${m} min`,
    lastReachable: `Last station you can reach (≥ ${RESERVE_PCT}% battery left)`,
    noneReachable: (p: number) => `With ${p}% battery, no station is safely reachable (≥ ${RESERVE_PCT}% left)`,
    pctAria: (p: number) => `about ${p}% battery left on arrival`,
    plan: 'Plan charging stops',
    planAria: 'Planned charging stops',
    stop: (n: number) => `Stop ${n}`,
    stopLine: (arrive: string, to: number, charge: string | null, kw: string) =>
      `arrive ${arrive}` + (charge ? ` · charge to ${to}% ~${charge} (${kw} kW)` : ` · ${kw} kW`),
    noStop: (arrive: string) => `No charging stop needed — you'll arrive with ${arrive}.`,
    planOk: (n: number, charge: string, total: string, arrive: string) =>
      `${n} ${n === 1 ? 'stop' : 'stops'} · ~${charge} charging · arrive in ~${total} with ${arrive}.`,
    planFail: (km: number) =>
      `Not enough fast chargers (DC ≥ ${PLAN_MIN_DC_KW} kW) after km ${km} — try a wider corridor, fewer power filters or more starting battery.`,
    planNote: 'Estimate: stop at the farthest station with ≥ 10% left, charge to 80% (just enough at the last stop).',
    routes: 'Routes',
    routeCard: (km: number, n: number) => `${km} km · ${n} ${n === 1 ? 'station' : 'stations'}`,
    googleHint: (n: number) => `In Google Maps you picked route ${n} — tap the matching one below or on the map.`,
    avoid: 'Avoid',
    avoidOpt: { toll: 'Tolls', highway: 'Highways', ferry: 'Ferries' },
  },
})

interface Props {
  trip: TripState
  hits: RouteHits
  power: Map<string, StationPower> | null
  /** Đang mở chi tiết trạm: tự thu bảng xuống để không che (giống `detailOpen` bên Android). */
  stationOpen: boolean
  onOpen: (text: string) => void
  onRadius: (km: TripRadius) => void
  /** Số trạm của từng tuyến (rỗng khi chỉ có một tuyến). */
  routeTotals: number[]
  onSelectRoute: (i: number) => void
  onAvoid: (avoid: Avoid) => void
  /** Mức công suất đang lọc (rỗng = tất cả). Đổi ở đây là đổi luôn Cài đặt hiển thị. */
  kwBands: KwBand[]
  onKwBands: (bands: KwBand[]) => void
  onPick: (st: Station) => void
  onClose: () => void
  /** Xe đã chọn (null = không ước tính pin) + % pin lúc xuất phát. */
  vehicle: Vehicle | null
  climate: boolean
  battery: BatteryReading | null
  batteryStale: boolean
  onBattery: (pct: number) => void
  /** Kế hoạch dừng sạc (App tính khi bật — bản đồ cũng chỉ vẽ điểm dừng). */
  planOn: boolean
  plan: ChargePlan | null
  onTogglePlan: () => void
}

/**
 * Bảng "Trạm dọc đường". KHÔNG phải hộp thoại modal: bản đồ phía sau vẫn kéo/zoom được để xem
 * tuyến, và bảng chi tiết trạm mở đè lên được. Điện thoại: dải dưới đáy, bấm tay cầm để thu/mở.
 * Màn rộng: thẻ nổi góc trái.
 */
export function TripPanel({ trip, hits, power, stationOpen, onOpen, onRadius, routeTotals, onSelectRoute, onAvoid, kwBands, onKwBands, onPick, onClose, vehicle, climate, battery, batteryStale, onBattery, planOn, plan, onTogglePlan }: Props) {
  const [text, setText] = useState(trip.link ?? '')
  const [expanded, setExpanded] = useState(true)
  // Link đổi từ ngoài (mở /trip?link=…, share target) → ô nhập theo.
  useEffect(() => setText(trip.link ?? ''), [trip.link])
  useEffect(() => {
    if (stationOpen) setExpanded(false)
  }, [stationOpen])

  const shownBands = kwActive(kwBands) ? kwBands : KW_BANDS
  function toggleBand(b: KwBand) {
    const on = shownBands.includes(b)
    if (on && shownBands.length === 1) return // giữ ít nhất một mức
    onKwBands(KW_BANDS.filter((x) => (x === b ? !on : shownBands.includes(x))))
  }

  const busy = trip.status === 'resolving' || trip.status === 'routing'

  // % pin khi ngang qua từng trạm: rẽ vào rồi quay ra tuyến (2 × độ lệch), tốc độ trung bình cả tuyến.
  const startPct = pctOf(battery)
  const route = trip.route
  const estimates: ArrivalEstimate[] | null =
    vehicle && route && trip.status === 'ready'
      ? hits.items.map((h) =>
          arrivalPct(startPct, h.atKm + 2 * h.offsetKm, avgKmh(route.meters, route.seconds), vehicle, climate),
        )
      : null
  let lastOk = -1
  if (estimates) for (let i = 0; i < estimates.length; i++) if (estimates[i].low >= RESERVE_PCT) lastOk = i

  function submit(e: FormEvent) {
    e.preventDefault()
    if (text.trim()) {
      onOpen(text.trim())
      setExpanded(true)
    }
  }

  async function paste() {
    try {
      const t = (await navigator.clipboard.readText()).trim()
      if (t) {
        setText(t)
        onOpen(t)
      }
    } catch {
      // Trình duyệt chặn đọc clipboard — người dùng dán tay vào ô.
    }
  }

  return (
    <section
      aria-label={L.title}
      className="absolute inset-x-0 bottom-0 z-[6] flex max-h-[60dvh] flex-col rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0 bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.12)] sm:inset-x-auto sm:bottom-14 sm:left-3 sm:max-h-[calc(100dvh-11rem)] sm:w-[380px] sm:rounded-2xl sm:shadow-xl"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? L.collapse : L.expand}
        className="flex justify-center pt-2 pb-1 sm:hidden"
      >
        <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
      </button>

      <header className="flex items-center gap-2 px-4 pt-1 sm:pt-3">
        <Route className="size-5 shrink-0 text-brand" aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-base font-bold">
          {trip.stops.length > 1 ? trip.stops.map((s) => s.label).join(' → ') : L.title}
        </h2>
        {!expanded && (
          <Button variant="ghost" size="icon-sm" aria-label={L.openPanel} onClick={() => setExpanded(true)}>
            <ChevronUp />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" aria-label={L.closeTrip} onClick={onClose}>
          <X />
        </Button>
      </header>

      <p className={`px-4 pt-1 pb-2 text-xs ${trip.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
        {busy && <Loader2 className="mr-1 inline size-3.5 animate-spin align-[-2px]" aria-hidden />}
        {summary(trip, hits)}
      </p>

      {expanded && (
        // Cả thân bảng cuộn chung: hộp cấu hình + thẻ tuyến đã cao, để riêng danh sách cuộn thì nó bị ép về 0.
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-3 [&>*]:shrink-0">
          <form onSubmit={submit} className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={L.placeholder}
              aria-label={L.linkAria}
              className="min-w-0"
              inputMode="url"
            />
            <Button type="button" variant="outline" size="icon" aria-label={L.paste} onClick={paste}>
              <ClipboardPaste />
            </Button>
            <Button type="submit" variant="brand" disabled={!text.trim() || busy}>
              {L.find}
            </Button>
          </form>

          {trip.routes.length > 1 && (
            <RoutePicker trip={trip} totals={routeTotals} onSelect={onSelectRoute} />
          )}

          {/* Cấu hình tìm trạm: hộp riêng, cách hẳn ô link. Chip nền trắng để nổi trên nền xám. */}
          <div className="mt-2 flex flex-col gap-3 rounded-xl bg-muted/70 p-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">{L.fromRoute}</span>
              <div className="flex flex-wrap gap-1.5">
                {TRIP_RADII.map((km) => (
                  <Chip key={km} size="sm" variant="outline" selected={trip.radiusKm === km} onClick={() => onRadius(km)}>
                    {km} km
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">{L.avoid}</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={L.avoid}>
                {AVOID_KEYS.map((k) => (
                  <Chip
                    key={k}
                    size="sm"
                    variant="outline"
                    selected={trip.avoid[k]}
                    disabled={busy}
                    aria-pressed={trip.avoid[k]}
                    onClick={() => onAvoid({ ...trip.avoid, [k]: !trip.avoid[k] })}
                  >
                    {L.avoidOpt[k]}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">{L.power}</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={L.power}>
                {KW_BANDS.map((b) => (
                  <Chip key={b} size="sm" variant="outline" selected={shownBands.includes(b)} onClick={() => toggleBand(b)}>
                    {KW_BAND_LABEL[b]}
                  </Chip>
                ))}
              </div>
            </div>

            {estimates && (
              <>
                <BatteryControl reading={battery} stale={batteryStale} onChange={onBattery} compact />
                <Chip size="sm" variant="outline" selected={planOn} onClick={onTogglePlan} className="self-start">
                  <Zap />
                  {L.plan}
                </Chip>
              </>
            )}
          </div>

          {planOn && plan && <PlanView plan={plan} onPick={onPick} />}

          {!(planOn && plan) && hits.items.length > 0 && (
            <ul className="-mx-4 px-4" aria-label={L.listAria}>
              {estimates && lastOk === -1 && <ReachDivider text={L.noneReachable(startPct)} />}
              {hits.items.map(({ station, atKm, offsetKm }, i) => {
                const p = power?.get(station.entityId)
                const est = estimates?.[i]
                return (
                  <Fragment key={station.entityId}>
                    <li className="border-b border-border/60 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => onPick(station)}
                        className="flex w-full items-center gap-3 py-2.5 text-left"
                      >
                        <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-brand">
                          km {Math.round(atKm)}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="line-clamp-2 text-[15px] leading-snug">{station.name}</span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ background: TIER_COLORS[tierOf(p)] }}
                              aria-hidden
                            />
                            {L.offRoute(fmtDistance(offsetKm))}
                            {p ? L.maxKw(fmtKw(p.maxKw)) : ''}
                          </span>
                        </span>
                        {est && <ArrivalPct est={est} />}
                      </button>
                    </li>
                    {i === lastOk && i < hits.items.length - 1 && <ReachDivider text={L.lastReachable} />}
                  </Fragment>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

const AVOID_KEYS = ['toll', 'highway', 'ferry'] as const

/**
 * Các tuyến HERE gợi ý (khi đi thẳng 2 điểm). Thứ tự khác Google nên chỉ gợi ý bằng chữ
 * khi người dùng đã chọn tuyến khác tuyến đầu trên Google (`!5iN`).
 */
function RoutePicker({ trip, totals, onSelect }: { trip: TripState; totals: number[]; onSelect: (i: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      {trip.googleRoute !== null && trip.googleRoute > 0 && (
        <p className="text-xs text-muted-foreground">{L.googleHint(trip.googleRoute + 1)}</p>
      )}
      <div role="radiogroup" aria-label={L.routes} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
        {trip.routes.map((r, i) => {
          const on = i === trip.routeIdx
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(i)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs tabular-nums transition-colors ${
                on ? 'border-brand bg-brand/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              <span className={`block text-sm font-semibold ${on ? 'text-brand' : 'text-foreground'}`}>{fmtDuration(r.seconds)}</span>
              {L.routeCard(Math.round(r.meters / 1000), totals[i] ?? 0)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Tóm tắt kế hoạch + danh sách điểm dừng (thay danh sách trạm khi bật). */
function PlanView({ plan, onPick }: { plan: ChargePlan; onPick: (st: Station) => void }) {
  const head = !plan.ok
    ? L.planFail(Math.round(plan.stuckAtKm))
    : plan.stops.length === 0
      ? L.noStop(fmtRange(plan.arriveDest))
      : L.planOk(plan.stops.length, fmtMinutes(plan.chargeMin * 60), fmtDuration(plan.totalSeconds), fmtRange(plan.arriveDest))
  return (
    <>
      <p className={`rounded-xl px-3 py-2 text-sm ${plan.ok ? 'bg-brand/10 text-foreground' : 'bg-destructive/10 text-destructive'}`}>
        {head}
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{L.planNote}</span>
      </p>
      {plan.stops.length > 0 && (
        <ol className="-mx-4 px-4" aria-label={L.planAria}>
          {plan.stops.map((s, i) => (
            <li key={s.item.station.entityId} className="border-b border-border/60 last:border-b-0">
              <button type="button" onClick={() => onPick(s.item.station)} className="flex w-full items-center gap-3 py-2.5 text-left">
                <span className="flex w-14 shrink-0 flex-col text-sm font-semibold tabular-nums text-brand">
                  <span>{L.stop(i + 1)}</span>
                  <span className="text-xs font-normal text-muted-foreground">km {Math.round(s.item.atKm)}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-2 text-[15px] leading-snug">{s.item.station.name}</span>
                  <span className={`text-xs ${pctTone(s.arrive.low)}`}>
                    {L.stopLine(fmtRange(s.arrive), s.toPct, s.chargeMin === null ? null : fmtMinutes(s.chargeMin * 60), fmtKw(s.kw))}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

/** Số giữa của khoảng ước tính; không tới được thì gạch đỏ. */
function ArrivalPct({ est }: { est: ArrivalEstimate }) {
  const mid = Math.round((est.low + est.high) / 2)
  if (est.high < 0) return <span className="w-11 shrink-0 text-right text-sm font-semibold text-destructive">—</span>
  return (
    <span
      className={`w-11 shrink-0 text-right text-sm font-semibold tabular-nums ${pctTone(est.low)}`}
      aria-label={L.pctAria(Math.max(0, mid))}
    >
      ~{Math.max(0, mid)}%
    </span>
  )
}

/** Vạch ngăn giữa trạm còn kịp và trạm có thể không tới được. */
function ReachDivider({ text }: { text: string }) {
  return (
    <li role="separator" className="flex items-center gap-2 border-y-2 border-[#F0A500]/60 bg-[#F0A500]/10 px-2 py-1.5 text-xs font-medium text-[#B45309] dark:text-[#F0A500]">
      {text}
    </li>
  )
}

function summary(trip: TripState, hits: RouteHits): string {
  switch (trip.status) {
    case 'resolving':
      return L.resolving
    case 'routing':
      return L.routing
    case 'error':
      return trip.error ?? L.error
    case 'ready': {
      const r = trip.route
      if (!r) return ''
      const via = trip.stops.length > 2 ? L.via(trip.stops.length - 2) : ''
      const count = L.count(hits.total, trip.radiusKm)
      const cap = hits.total > hits.items.length ? L.cap(hits.items.length) : ''
      return `${via}${Math.round(r.meters / 1000)} km · ${fmtDuration(r.seconds)} · ${count}${cap}`
    }
    default:
      return L.idle
  }
}

function fmtDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return L.min(m)
  const h = Math.floor(m / 60)
  return m % 60 ? L.hrMin(h, m % 60) : L.hr(h)
}
