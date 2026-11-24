import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import { ChevronDown, ChevronUp, ClipboardPaste, Loader2, Route, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { fmtDistance, fmtKw, fmtMinutes } from '@/lib/format'
import type { RouteHits } from '../data/routeCorridor'
import type { TripState } from '../data/useTrip'
import { TRIP_RADII, type TripRadius } from '../data/tripTypes'
import type { Station, StationPower } from '../data/types'
import { KW_BANDS, KW_BAND_LABEL, kwActive, tierOf, type KwBand } from '../data/stations'
import { TIER_COLORS } from '../map/pins'
import { pick } from '../i18n'
import { arrivalPct, avgKmh, type ArrivalEstimate, type BatteryReading } from '../data/battery'
import type { Vehicle } from '../data/vehicles'
import { BatteryControl, DANGER_PCT, fmtRange, pctOf, pctTone } from './BatteryControl'
import { PLAN_MIN_DC_KW, passByKm, type ChargePlan } from '../data/chargePlan'
import { chargeCost, fmtVnd } from '../data/cost'
import type { Avoid } from '../lib/mapsLink'
import { useIsMobile } from '@/hooks/use-media-query'
import type { Place } from '../data/places'
import { PlaceChips, stopLabel } from './PlaceChips'
import { readStr, writeStr } from '@/lib/storage'

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
    viaExit: 'phải ra cao tốc',
    exitDetour: (km: number) => `phải ra cao tốc, vòng thêm ~${km} km`,
    maxKw: (kw: string) => ` · tối đa ${kw} kW`,
    resolving: 'Đang đọc liên kết…',
    routing: 'Đang tính đường và tìm trạm…',
    error: 'Có lỗi xảy ra.',
    via: (n: number) => `qua ${n} điểm dừng · `,
    count: (n: number, km: number) => `${n} trạm trong ${km} km`,
    cap: (n: number) => ` (hiện ${n} trạm sát tuyến nhất)`,
    idle: 'Mở Google Maps, chỉ đường rồi bấm Chia sẻ → Trạm sạc, hoặc dán link vào đây.',
    lastReachable: (r: number) => `Trạm cuối còn kịp (còn ≥ ${r}% pin)`,
    noneReachable: (p: number, r: number) => `Với ${p}% pin, không trạm nào chắc chắn tới được (còn ≥ ${r}%)`,
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
    planNote: (r: number) => `Ước tính: ghé trạm xa nhất còn ≥ ${r}% pin, sạc lên 80% (điểm cuối sạc vừa đủ tới nơi). Ưu tiên trạm vào thẳng; chỉ ra cao tốc khi chặng đó không còn trạm nào khác. Đổi mức dự phòng trong Xe của bạn.`,
    routes: 'Tuyến đường',
    routeCard: (km: number, n: number) => `${km} km · ${n} trạm`,
    googleHint: (n: number) => `Trên Google bạn chọn tuyến thứ ${n} — chạm tuyến khớp bên dưới hoặc trên bản đồ.`,
    avoid: 'Tránh',
    avoidOpt: { toll: 'Thu phí', highway: 'Cao tốc', ferry: 'Phà' },
    options: 'Tuỳ chọn',
    optsShow: 'Mở tuỳ chọn',
    optsHide: 'Thu tuỳ chọn',
    allPower: 'mọi công suất',
    noAvoid: 'không tránh',
    avoidSum: (s: string) => `tránh ${s.toLowerCase()}`,
    planOn: 'kế hoạch sạc',
    planCost: (c: string) => `Tiền sạc dọc đường ${c}`,
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
    viaExit: 'exit the highway',
    exitDetour: (km: number) => `exit the highway, ~${km} km detour`,
    maxKw: (kw: string) => ` · up to ${kw} kW`,
    resolving: 'Reading link…',
    routing: 'Calculating route and finding stations…',
    error: 'Something went wrong.',
    via: (n: number) => `via ${n} ${n === 1 ? 'stop' : 'stops'} · `,
    count: (n: number, km: number) => `${n} ${n === 1 ? 'station' : 'stations'} within ${km} km`,
    cap: (n: number) => ` (showing ${n} closest to the route)`,
    idle: 'In Google Maps, get directions and tap Share → Trạm Sạc, or paste the link here.',
    lastReachable: (r: number) => `Last station you can reach (≥ ${r}% battery left)`,
    noneReachable: (p: number, r: number) => `With ${p}% battery, no station is safely reachable (≥ ${r}% left)`,
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
    planNote: (r: number) => `Estimate: stop at the farthest station with ≥ ${r}% left, charge to 80% (just enough at the last stop). Prefers stations you can drive straight into; exits the highway only when a leg has no other option. Change the reserve in Your car.`,
    routes: 'Routes',
    routeCard: (km: number, n: number) => `${km} km · ${n} ${n === 1 ? 'station' : 'stations'}`,
    googleHint: (n: number) => `In Google Maps you picked route ${n} — tap the matching one below or on the map.`,
    avoid: 'Avoid',
    avoidOpt: { toll: 'Tolls', highway: 'Highways', ferry: 'Ferries' },
    options: 'Options',
    optsShow: 'Show options',
    optsHide: 'Hide options',
    allPower: 'all power levels',
    noAvoid: 'no avoids',
    avoidSum: (s: string) => `avoid ${s.toLowerCase()}`,
    planOn: 'charging plan',
    planCost: (c: string) => `Charging cost on the way ${c}`,
  },
})

interface Props {
  /** Đang mở hành trình. Đóng thì vẫn gắn để drawer chạy hiệu ứng trượt xuống. */
  visible: boolean
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
  /** Địa điểm hay dùng: chip Từ / Tới khi chưa có tuyến, và tên chặng trùng địa điểm. */
  places: Place[]
  onRouteTo: (to: Place, from: Place | null) => void
  onManagePlaces: () => void
  onClose: () => void
  /** Xe đã chọn (null = không ước tính pin) + % pin lúc xuất phát. */
  vehicle: Vehicle | null
  climate: boolean
  /** Pin dự phòng tối thiểu (%). */
  reservePct: number
  /** Giá sạc đ/kWh — tiền sạc từng điểm dừng + tổng; 0 = miễn phí, ẩn. */
  pricePerKwh: number
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
export function TripPanel({ visible, trip: tripNow, hits: hitsNow, power, stationOpen, onOpen, onRadius, routeTotals, onSelectRoute, onAvoid, kwBands, onKwBands, onPick, places, onRouteTo, onManagePlaces, onClose, vehicle, climate, reservePct, pricePerKwh, battery, batteryStale, onBattery, planOn, plan, onTogglePlan }: Props) {
  // Đóng xong App xoá hành trình ngay; giữ bản lúc còn mở để bảng không chớp sang trạng thái trống
  // trong lúc trượt xuống.
  const last = useRef({ trip: tripNow, hits: hitsNow })
  if (visible) last.current = { trip: tripNow, hits: hitsNow }
  const { trip, hits } = visible ? { trip: tripNow, hits: hitsNow } : last.current
  const [text, setText] = useState(trip.link ?? '')
  const isMobile = useIsMobile()
  // Màn rộng: thẻ nổi thu/mở. Điện thoại: drawer vaul 3 mốc, "thu" = mốc thấp (chỉ còn tiêu đề).
  const [expanded, setExpanded] = useState(true)
  const [snap, setSnap] = useState<number | string | null>(TRIP_SNAP_MID)
  const open = isMobile ? snap !== TRIP_SNAP_PEEK : expanded
  const setOpen = (v: boolean) => (isMobile ? setSnap(v ? TRIP_SNAP_MID : TRIP_SNAP_PEEK) : setExpanded(v))
  // Link đổi từ ngoài (mở /trip?link=…, share target) → ô nhập theo.
  useEffect(() => setText(trip.link ?? ''), [trip.link])
  // Mở lại hành trình → về mốc giữa.
  useEffect(() => {
    if (visible) setSnap(TRIP_SNAP_MID)
  }, [visible])
  useEffect(() => {
    if (stationOpen) {
      setExpanded(false)
      setSnap(TRIP_SNAP_PEEK)
    }
  }, [stationOpen])
  const [optsOpen, setOptsOpen] = useState(readOptsOpen)
  function toggleOpts() {
    setOptsOpen((v) => {
      saveOptsOpen(!v)
      return !v
    })
  }

  const shownBands = kwActive(kwBands) ? kwBands : KW_BANDS
  function toggleBand(b: KwBand) {
    const on = shownBands.includes(b)
    if (on && shownBands.length === 1) return // giữ ít nhất một mức
    onKwBands(KW_BANDS.filter((x) => (x === b ? !on : shownBands.includes(x))))
  }

  const busy = trip.status === 'resolving' || trip.status === 'routing'

  // % pin khi ngang qua từng trạm: rẽ vào rồi quay ra tuyến (2 × accessKm: độ lệch, cộng quãng ra nút giao nếu phải ra cao tốc), tốc độ trung bình cả tuyến.
  const startPct = pctOf(battery)
  const route = trip.route
  const estimates: ArrivalEstimate[] | null =
    vehicle && route && trip.status === 'ready'
      ? hits.items.map((h) =>
          arrivalPct(startPct, passByKm(h), avgKmh(route.meters, route.seconds), vehicle, climate),
        )
      : null
  let lastOk = -1
  if (estimates) for (let i = 0; i < estimates.length; i++) if (estimates[i].low >= reservePct) lastOk = i
  // Từ trạm đầu tiên SAU vạch còn kịp mà pin bi quan < DANGER_PCT (chữ đỏ) trở xuống: nền đỏ.
  let dangerFrom = -1
  if (estimates) dangerFrom = estimates.findIndex((e, i) => i > lastOk && e.low < DANGER_PCT)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (text.trim()) {
      onOpen(text.trim())
      setOpen(true)
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

  const inner = (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? L.collapse : L.expand}
        className="flex justify-center pt-2 pb-1 sm:hidden"
      >
        <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
      </button>

      <header className="flex items-center gap-2 px-4 pt-1 sm:pt-3">
        <Route className="size-5 shrink-0 text-brand" aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-base font-bold">
          {trip.stops.length > 1 ? trip.stops.map((s) => stopLabel(s, places)).join(' → ') : L.title}
        </h2>
        {!open && (
          <Button variant="ghost" size="icon-sm" aria-label={L.openPanel} onClick={() => setOpen(true)}>
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

      {/* Điện thoại luôn dựng thân bảng (mốc thấp chỉ đẩy nó xuống dưới mép màn hình) để kéo lên là thấy ngay. */}
      {(isMobile || expanded) && (
        // Cả thân bảng cuộn chung: hộp cấu hình + thẻ tuyến đã cao, để riêng danh sách cuộn thì nó bị ép về 0.
        // overflow-x-hidden: overflow-y-auto kéo theo cuộn ngang, phần lề âm -mx-4 sẽ kéo lệch được.
        // pt-1: vùng cuộn cắt mọi thứ tràn ra — chừa chỗ cho viền focus (ring 3px) của ô link.
        <div
          className={`flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overscroll-contain px-4 pt-1 pb-3 [&>*]:shrink-0 ${
            // Điện thoại: chỉ cuộn khi bảng ở mốc cao nhất — mốc thấp hơn thì cú vuốt là kéo bảng (vaul).
            !isMobile || snap === 1 ? 'overflow-y-auto' : 'overflow-y-hidden'
          }`}
        >
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

          {/* Chưa có tuyến: chọn nhanh Từ / Tới địa điểm đã lưu. */}
          {(trip.status === 'idle' || trip.status === 'error') && (
            <PlaceChips places={places} onRoute={onRouteTo} onManage={onManagePlaces} />
          )}

          {trip.routes.length > 1 && (
            <RoutePicker trip={trip} totals={routeTotals} onSelect={onSelectRoute} />
          )}

          {/* Cấu hình tìm trạm: hộp riêng, cách hẳn ô link. Chip nền trắng để nổi trên nền xám.
              Thu lại được (nhớ trên máy) — thu thì chỉ còn một dòng tóm tắt. */}
          <div className="mt-2 flex flex-col gap-3 rounded-xl bg-muted/70 p-3">
            <button
              type="button"
              onClick={toggleOpts}
              aria-expanded={optsOpen}
              aria-label={optsOpen ? L.optsHide : L.optsShow}
              className="-m-1 flex items-center gap-2 rounded-lg p-1 text-left"
            >
              <span className="text-xs font-semibold text-foreground">{L.options}</span>
              {!optsOpen && (
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {optsSummary(trip, shownBands, estimates ? startPct : null, planOn)}
                </span>
              )}
              <ChevronDown
                className={`ml-auto size-4 shrink-0 text-muted-foreground transition-transform ${optsOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>

            {optsOpen && (
              <>
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
              </>
            )}
          </div>

          {planOn && plan && <PlanView plan={plan} reservePct={reservePct} vehicle={vehicle} pricePerKwh={pricePerKwh} onPick={onPick} />}

          {!(planOn && plan) && hits.items.length > 0 && (
            <ul className="-mx-4 px-4" aria-label={L.listAria}>
              {estimates && lastOk === -1 && <ZoneEdge tone="warn" text={L.noneReachable(startPct, reservePct)} />}
              {hits.items.map(({ station, atKm, offsetKm, viaExit }, i) => {
                const p = power?.get(station.entityId)
                const est = estimates?.[i]
                return (
                  <Fragment key={station.entityId}>
                    {i === dangerFrom && <ZoneEdge tone="danger" under="warn" />}
                    <li
                      className={`${
                        // Ngay trên mép răng cưa thì bỏ kẻ dưới — răng cưa đã là ranh giới.
                        i === lastOk || i === dangerFrom - 1 ? '' : 'border-b border-border/60 last:border-b-0'
                      } ${
                        // Vùng không chắc / dễ hết pin: nền tràn hết bề ngang, nối liền với mép răng cưa.
                        dangerFrom >= 0 && i >= dangerFrom
                          ? `-mx-4 px-4 ${ZONE_BG.danger}`
                          : estimates && i > lastOk
                            ? `-mx-4 px-4 ${ZONE_BG.warn}`
                            : ''
                      }`}
                    >
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
                            {viaExit ? L.viaExit : L.offRoute(fmtDistance(offsetKm))}
                            {p ? L.maxKw(fmtKw(p.maxKw)) : ''}
                          </span>
                        </span>
                        {est && <ArrivalPct est={est} />}
                      </button>
                    </li>
                    {i === lastOk && i < hits.items.length - 1 && <ZoneEdge tone="warn" text={L.lastReachable(reservePct)} />}
                  </Fragment>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </>
  )

  if (isMobile) {
    return (
      // Không chặn bản đồ (modal={false}, không lớp phủ), không vuốt để đóng — đóng bằng nút ✕.
      // snapPoints: vaul tự chia cử chỉ — chưa ở mốc cao nhất thì vuốt là kéo bảng, ở mốc cao nhất mới cuộn.
      <DrawerPrimitive.Root
        open={visible}
        modal={false}
        dismissible={false}
        snapPoints={TRIP_SNAPS}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
      >
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Content
            aria-label={L.title}
            aria-describedby={undefined}
            // Không tự focus ô link khi mở (bàn phím bật lên che bản đồ).
            onOpenAutoFocus={(e) => e.preventDefault()}
            style={{ height: TRIP_SHEET_FULL }}
            className="fixed inset-x-0 bottom-0 z-[6] flex flex-col rounded-t-2xl bg-card pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] outline-none"
          >
            <DrawerPrimitive.Title className="sr-only">{L.title}</DrawerPrimitive.Title>
            {inner}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    )
  }

  if (!visible) return null
  return (
    <section
      aria-label={L.title}
      className="absolute bottom-14 left-3 z-[6] flex max-h-[calc(100dvh-11rem)] w-[380px] flex-col rounded-2xl bg-card shadow-xl"
    >
      {inner}
    </section>
  )
}

const AVOID_KEYS = ['toll', 'highway', 'ferry'] as const

/**
 * Mốc snap của bảng Dọc đường trên điện thoại: thấp (tay cầm + tiêu đề + dòng tóm tắt), 60% màn
 * hình, gần full. Bảng cao cố định TRIP_SHEET_FULL, vaul dịch xuống theo mốc.
 */
const TRIP_SNAP_PEEK = '118px'
const TRIP_SNAP_MID = 0.6
const TRIP_SNAPS = [TRIP_SNAP_PEEK, TRIP_SNAP_MID, 1]
const TRIP_SHEET_FULL = 'calc(100dvh - env(safe-area-inset-top) - 8px)'

/** Hộp tuỳ chọn đang mở hay thu — tiện ích riêng từng máy, lỗi storage thì mặc định mở. */
const OPTS_KEY = 'tramsac.tripOpts'
const readOptsOpen = (): boolean => readStr(OPTS_KEY) !== '0'
/** Chế độ riêng tư chặn localStorage — chỉ mất phần nhớ. */
const saveOptsOpen = (open: boolean) => writeStr(OPTS_KEY, open ? '1' : '0')

/** "2 km · tránh thu phí · ≥ 120 kW, 60–119 kW · 55%" — dòng tóm tắt khi hộp tuỳ chọn thu lại. */
function optsSummary(trip: TripState, bands: KwBand[], pct: number | null, planOn: boolean): string {
  const avoided = AVOID_KEYS.filter((k) => trip.avoid[k]).map((k) => L.avoidOpt[k])
  return [
    `${trip.radiusKm} km`,
    avoided.length ? L.avoidSum(avoided.join(', ')) : L.noAvoid,
    bands.length === KW_BANDS.length ? L.allPower : bands.map((b) => KW_BAND_LABEL[b]).join(', '),
    pct === null ? null : `${pct}%`,
    planOn ? L.planOn : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

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
              <span className={`block text-sm font-semibold ${on ? 'text-brand' : 'text-foreground'}`}>{fmtMinutes(r.seconds)}</span>
              {L.routeCard(Math.round(r.meters / 1000), totals[i] ?? 0)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Tóm tắt kế hoạch + danh sách điểm dừng (thay danh sách trạm khi bật). */
function PlanView({
  plan,
  reservePct,
  vehicle,
  pricePerKwh,
  onPick,
}: {
  plan: ChargePlan
  reservePct: number
  vehicle: Vehicle | null
  pricePerKwh: number
  onPick: (st: Station) => void
}) {
  // Tiền sạc mỗi điểm dừng: từ % khi tới (giữa khoảng ước tính) lên mức sạc tới.
  const costs = plan.stops.map((s) =>
    vehicle && s.chargeMin !== null ? chargeCost((s.arrive.low + s.arrive.high) / 2, s.toPct, vehicle, pricePerKwh) : null,
  )
  const total = costs.reduce<number | null>((sum, c) => (c === null ? sum : (sum ?? 0) + c), null)
  const head = !plan.ok
    ? L.planFail(Math.round(plan.stuckAtKm))
    : plan.stops.length === 0
      ? L.noStop(fmtRange(plan.arriveDest))
      : L.planOk(plan.stops.length, fmtMinutes(plan.chargeMin * 60), fmtMinutes(plan.totalSeconds), fmtRange(plan.arriveDest))
  return (
    <>
      <p className={`rounded-xl px-3 py-2 text-sm ${plan.ok ? 'bg-brand/10 text-foreground' : 'bg-destructive/10 text-destructive'}`}>
        {head}
        {plan.ok && total !== null && <span className="block font-semibold">{L.planCost(fmtVnd(total))}</span>}
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{L.planNote(reservePct)}</span>
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
                    {costs[i] !== null && <span className="text-muted-foreground"> · {fmtVnd(costs[i]!)}</span>}
                  </span>
                  {s.item.viaExit && (
                    <span className="text-xs text-[#B45309] dark:text-[#F0A500]">{L.exitDetour(Math.round(s.detourKm))}</span>
                  )}
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
/** Nền vùng "không chắc tới được" (vàng) và "dễ hết pin" (đỏ) — mép răng cưa và các trạm phía sau dùng chung. */
const ZONE_BG = { warn: 'bg-gold/12', danger: 'bg-destructive/10' } as const
/** Mép răng cưa: mask SVG (răng nhọn lên) trên nền của vùng, nên màu ăn theo giao diện sáng/tối. */
const ZIGZAG_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='14' height='7' viewBox='0 0 14 7'><path d='M0 7 7 0 14 7Z'/></svg>",
)}")`

/**
 * Mép trên của một vùng: từ đây trở xuống nền vàng (không chắc kịp) hoặc đỏ (dễ hết pin), mép
 * răng cưa. Vùng vàng kèm một dòng chữ; vùng đỏ chỉ có mép — chữ % đỏ đã nói đủ.
 */
function ZoneEdge({ tone, text, under }: { tone: keyof typeof ZONE_BG; text?: string; under?: keyof typeof ZONE_BG }) {
  return (
    // `under`: nền vùng phía trên (lộ ra giữa các răng) — mép đỏ luôn nằm ngay sau vùng vàng.
    <li role="separator" aria-label={text} className={`-mx-4 ${under ? `pt-1 ${ZONE_BG[under]}` : 'mt-1'}`}>
      <div
        aria-hidden
        className={`h-[7px] ${ZONE_BG[tone]}`}
        style={{ maskImage: ZIGZAG_MASK, WebkitMaskImage: ZIGZAG_MASK, maskSize: '14px 7px', WebkitMaskSize: '14px 7px', maskRepeat: 'repeat-x', WebkitMaskRepeat: 'repeat-x' }}
      />
      {text && (
        <div className={`px-4 pt-1.5 pb-1 text-xs font-medium text-warn ${ZONE_BG[tone]}`}>{text}</div>
      )}
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
      return `${via}${Math.round(r.meters / 1000)} km · ${fmtMinutes(r.seconds)} · ${count}${cap}`
    }
    default:
      return L.idle
  }
}

