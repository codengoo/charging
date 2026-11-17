import { useMemo, useState } from 'react'
import { BarChart3, Clock, Info, PlugZap, RefreshCw, Wrench, Zap } from 'lucide-react'
import { Chip } from '@/components/ui/chip'
import { Button } from '@/components/ui/button'
import { fmtKw } from '@/lib/format'
import { LOCALE, pick } from '@/i18n'
import {
  HISTORY_RANGES,
  UNAVAILABLE,
  analyseHistory,
  estimateFromHistory,
  windowHistory,
  type HistoryRange,
  type HistoryStats,
  type LivePorts,
  type LiveState,
} from '../data/live'
import type { StationPower } from '../data/types'

const L = pick({
  vi: {
    ports: (n: number) => `${n} cổng`,
    max: (kw: string) => `tối đa ${kw} kW`,
    loadingPorts: 'Đang tải số cổng…',
    noPorts: 'Chưa có thông tin cổng sạc cho trạm này.',
    fetching: 'đang lấy cổng trống…',
    updated: (t: string) => `cổng trống lúc ${t}`,
    estimated: (t: string) => `ước tính lúc ${t}`,
    inUse: 'đang cắm',
    estimateNote: (n: number) => `Ước tính từ số xe đang sạc (${n} xe) — chưa trừ cổng hỏng / đặt trước.`,
    liveFailed: (e: string) => `${e} — chưa lấy được số cổng trống.`,
    retry: 'Thử lại',
    maintenance: 'Trạm đang bảo trì.',
    noLive: 'Trạm này không báo số cổng trống.',
    charging: (n: number) => `${n} xe đang sạc`,
    maint: (n: number) => `${n} cổng bảo trì / tạm khoá`,
    forecast: (cars: number, kw: string, range: string) => `${cars} xe đang sạc trụ ${kw} kW sẽ xong sau ${range}`,
    minutes: (a: number, b: number) => (a === b ? `${a}p` : `${a}–${b}p`),
    forecastNote: 'Dự báo thống kê, không phải số đo.',
    lastHours: (h: number) => `${h} giờ qua`,
    range: 'Khoảng thời gian',
    all: 'Tất cả',
    noHistory: 'Trạm này không có lịch sử 24h.',
    historyFailed: (e: string) => `${e} — chưa lấy được lịch sử.`,
    missing: (m: number, h: number) => `Thiếu ${m} phút dữ liệu trong ${h}h — đã loại khỏi thống kê.`,
    chartLabel: (peak: number) => `Số xe đang sạc theo giờ, cao nhất ${peak} xe`,
    noData: (h: number) => `${h}h: không có dữ liệu`,
    hourAvg: (h: number, v: string) => `${h}h: ~${v} xe`,
    fill: 'Lấp đầy',
    fillHint: 'Trung bình số xe đang sạc so với tổng số cổng trong khoảng này.',
    busiest: 'Đông nhất',
    quietest: 'Vắng nhất',
    avgShort: (v: string) => `TB ${v} xe`,
    cars: (v: string) => `${v} xe`,
  },
  en: {
    ports: (n: number) => `${n} port${n === 1 ? '' : 's'}`,
    max: (kw: string) => `up to ${kw} kW`,
    loadingPorts: 'Loading ports…',
    noPorts: 'No port information for this station yet.',
    fetching: 'checking free ports…',
    updated: (t: string) => `free ports at ${t}`,
    estimated: (t: string) => `estimated at ${t}`,
    inUse: 'in use',
    estimateNote: (n: number) => `Estimated from cars charging (${n}) — broken / reserved ports not excluded.`,
    liveFailed: (e: string) => `${e} — couldn't get free ports.`,
    retry: 'Retry',
    maintenance: 'Station under maintenance.',
    noLive: "This station doesn't report free ports.",
    charging: (n: number) => `${n} car${n === 1 ? '' : 's'} charging`,
    maint: (n: number) => `${n} port${n === 1 ? '' : 's'} under maintenance / locked`,
    forecast: (cars: number, kw: string, range: string) =>
      `${cars} car${cars === 1 ? '' : 's'} on ${kw} kW will finish in ${range}`,
    minutes: (a: number, b: number) => (a === b ? `${a} min` : `${a}–${b} min`),
    forecastNote: 'Statistical forecast, not a measurement.',
    lastHours: (h: number) => `Last ${h} hours`,
    range: 'Time range',
    all: 'All',
    noHistory: 'No 24-hour history for this station.',
    historyFailed: (e: string) => `${e} — couldn't load history.`,
    missing: (m: number, h: number) => `${m} minutes of data missing in ${h}h — excluded from stats.`,
    chartLabel: (peak: number) => `Cars charging by hour, peak ${peak}`,
    noData: (h: number) => `${h}:00: no data`,
    hourAvg: (h: number, v: string) => `${h}:00: ~${v} cars`,
    fill: 'Occupancy',
    fillHint: 'Average cars charging versus total ports over this period.',
    busiest: 'Busiest',
    quietest: 'Quietest',
    avgShort: (v: string) => `avg ${v}`,
    cars: (v: string) => `${v} car${v === '1' ? '' : 's'}`,
  },
})

interface Row {
  kw: number
  count: number
  dc: boolean | null
  free: number | null
  total: number | null
}

/**
 * Ghép nhóm cổng tĩnh (VinFast / My Maps) với số cổng trống (EVCS) theo mức kW: chưa có số
 * trống thì vẫn hiện số cổng; có rồi thì thêm "trống x/y" vào đúng chip. Mức kW chỉ EVCS có
 * (tĩnh chưa biết) thì nối thêm vào cuối.
 */
function mergeRows(power: StationPower | undefined, live: LivePorts[] | null): Row[] {
  const rows: Row[] = (power?.groups ?? []).map((g) => ({ kw: g.kw, count: g.count, dc: g.dc, free: null, total: null }))
  for (const p of live ?? []) {
    const r = rows.find((x) => x.kw === p.kw)
    if (r) {
      r.free = p.free
      r.total = p.total
    } else rows.push({ kw: p.kw, count: p.total, dc: null, free: p.free, total: p.total })
  }
  return rows.sort((a, b) => b.kw - a.kw)
}

/**
 * Khối "Cổng sạc" GỘP số cổng và số cổng trống: tổng cổng + công suất tối đa + chuẩn sạc, rồi
 * mỗi mức kW một chip. Số cổng tĩnh hiện ngay; số trống (EVCS) về sau thì cập nhật vào chip.
 */
export function PortsBox({
  power,
  powerLoading,
  standards,
  live,
}: {
  power?: StationPower
  powerLoading?: boolean
  standards?: string[]
  live?: LiveState
}) {
  const st = live?.live ?? null
  const estimate = useMemo(
    () => (live && !st && live.liveError ? estimateFromHistory(live.history, power?.groups ?? []) : null),
    [live, st, power],
  )
  const livePorts = st?.ports ?? estimate?.ports ?? null
  const rows = mergeRows(power, livePorts)
  const approx = !st && !!estimate
  const status = st ? L.updated(clock(st.at)) : estimate ? L.estimated(clock(estimate.at)) : live?.liveLoading ? L.fetching : null

  return (
    <section className="mt-3 rounded-xl bg-muted px-3 py-2.5" aria-label={L.ports(power?.portCount ?? 0)}>
      <div className="flex items-start gap-2 text-sm">
        <PlugZap className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        {power ? (
          <span>
            <span className="font-semibold">{L.ports(power.portCount)}</span>
            <span className="text-muted-foreground"> · {L.max(fmtKw(power.maxKw))}</span>
            {standards && standards.length > 0 && <span className="text-muted-foreground"> · {standards.join(', ')}</span>}
          </span>
        ) : (
          <span className="text-muted-foreground">{powerLoading ? L.loadingPorts : rows.length ? '' : L.noPorts}</span>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {rows.map((r) => (
            <PortChip key={r.kw} row={r} approx={approx} />
          ))}
        </div>
      )}

      {live && (
        <div className="mt-1.5 flex flex-col gap-1 text-xs text-muted-foreground">
          {status && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" aria-hidden /> {status}
            </span>
          )}
          {st?.maintenance && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <Wrench className="size-4" aria-hidden /> {L.maintenance}
            </span>
          )}
          {st && st.ports.length === 0 && !st.maintenance && <span>{L.noLive}</span>}
          {st && (st.charging > 0 || st.maintPorts > 0) && (
            <span>
              {st.charging > 0 && L.charging(st.charging)}
              {st.charging > 0 && st.maintPorts > 0 && ' · '}
              {st.maintPorts > 0 && L.maint(st.maintPorts)}
            </span>
          )}
          {estimate && <span>{L.estimateNote(estimate.charging)}</span>}
          {live.liveError && live.liveError !== UNAVAILABLE && !estimate && !live.historyLoading && (
            <span className="flex items-center justify-between gap-2">
              {L.liveFailed(live.liveError)}
              <Button variant="ghost" size="sm" onClick={live.retry}>
                <RefreshCw /> {L.retry}
              </Button>
            </span>
          )}
        </div>
      )}

      {st && st.forecast.length > 0 && (
        <div className="mt-2 flex gap-2 rounded-lg bg-brand/10 px-2.5 py-2 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          <div>
            {st.forecast.map((f, i) => (
              <p key={i} className="font-medium">
                {L.forecast(f.cars, fmtKw(f.kw), L.minutes(f.minMinutes, f.maxMinutes))}
              </p>
            ))}
            <p className="text-xs text-muted-foreground">{L.forecastNote}</p>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * Mỗi mức công suất một màu — cùng họ màu với ghim (AC xanh lá, DC < 120 xanh dương, DC ≥ 120
 * tím) nhưng tách thêm bậc để trạm nhiều mức vẫn phân biệt được từng chip.
 */
export function kwColor(kw: number, dc: boolean | null): string {
  if (dc === false || kw <= 11) return '#12B76A'
  if (kw >= 150) return '#C026D3'
  if (kw >= 120) return '#7C3AED'
  if (kw >= 60) return '#0284C7'
  return '#0D9488'
}

/**
 * Chip = thanh tiến độ: phần ĐANG CẮM là viên màu đặc (chuyển sắc), phần còn trống là nền pastel
 * cùng màu. Chưa có số realtime thì chỉ có nền pastel "× N". Đầy (hết cổng trống) chuyển đỏ.
 * Chữ vẽ hai lớp: lớp dưới chữ đậm trên nền pastel, lớp trên chữ trắng trên nền đặc, cắt
 * theo đúng phần đã tô (bo tròn cả đầu thanh) — chữ vắt qua mép thanh vẫn đủ tương phản.
 */
const FULL_RED = '#E53935'
/** Khoảng hở giữa thanh tô màu và mép track (px). */
const FILL_GAP = 3

/**
 * Cắt lớp tô màu (phủ kín chip) thành viên nằm trong track, hở FILL_GAP mỗi phía: dài
 * (W − 2·gap)·p tính từ mép trái trong. Mép phải cách lề chip W·(1−p) + gap·(2p − 1).
 */
function fillClip(pct: number): string {
  const p = pct / 100
  return `inset(${FILL_GAP}px calc(${100 - pct}% + ${FILL_GAP * (2 * p - 1)}px) ${FILL_GAP}px ${FILL_GAP}px round 9999px)`
}

function PortChip({ row: r, approx }: { row: Row; approx: boolean }) {
  const hasLive = r.free !== null && r.total !== null && r.total > 0
  const used = hasLive ? r.total! - r.free! : 0
  const pct = hasLive ? Math.round((used / r.total!) * 100) : 0
  const full = hasLive && used >= r.total!
  // Hết cổng trống: cả chip chuyển đỏ, bất kể màu của mức kW — nhìn lướt là biết "đầy".
  const color = full ? FULL_RED : kwColor(r.kw, r.dc)
  // Đầu đậm (chữ trắng đọc được) → cuối sáng dần về màu gốc.
  const solid = `linear-gradient(90deg, color-mix(in srgb, ${color} 78%, #000), ${color})`
  const track = `color-mix(in srgb, ${color} 15%, var(--card))`
  const ink = `color-mix(in srgb, ${color} 75%, var(--foreground))`
  const content = (onSolid: boolean) => (
    <>
      <span className="flex items-center gap-1 font-semibold" style={{ color: onSolid ? '#fff' : ink }}>
        <Zap className="size-3.5" fill="currentColor" strokeWidth={0} aria-hidden />
        {fmtKw(r.kw)} kW
      </span>
      {hasLive ? (
        <span className={onSolid ? 'text-white/90' : 'text-foreground/80'}>
          {L.inUse} {approx && '~'}
          <span className={onSolid ? 'font-bold text-white' : 'font-bold text-foreground'}>
            {used}/{r.total}
          </span>
        </span>
      ) : (
        <span className="text-foreground/80">× {r.count}</span>
      )}
      {r.dc !== null && (
        <span className="ml-auto font-semibold" style={{ color: onSolid ? '#fff' : ink }}>
          {r.dc ? 'DC' : 'AC'}
        </span>
      )}
    </>
  )
  // Thanh kéo hết bề ngang hộp (mỗi mức kW một dòng); lớp tô đè dùng đúng bố cục này để chữ trùng khít.
  const box = 'flex w-full h-8 items-center gap-2 pr-3.5 pl-3 text-xs whitespace-nowrap'
  return (
    <span
      className={`relative shrink-0 overflow-hidden rounded-full ${box}`}
      style={{ background: track }}
      role={hasLive ? 'meter' : undefined}
      aria-valuemin={hasLive ? 0 : undefined}
      aria-valuemax={hasLive ? r.total! : undefined}
      aria-valuenow={hasLive ? used : undefined}
    >
      {content(false)}
      {hasLive && pct > 0 && (
        <span
          aria-hidden
          className={`absolute inset-0 transition-[clip-path] duration-500 ${box}`}
          style={{ background: solid, clipPath: fillClip(pct) }}
        >
          {content(true)}
        </span>
      )}
    </span>
  )
}

/** Khối "N giờ qua": vòng lấp đầy + biểu đồ theo giờ (kèm đường trung bình), dưới là giờ đông/vắng. */
export function HistoryBox({ live, power }: { live: LiveState; power?: StationPower }) {
  const { history, historyLoading, historyError } = live
  const [range, setRange] = useState<HistoryRange>(24)
  const portsByKw = useMemo(() => new Map((power?.groups ?? []).map((g) => [g.kw, g.count])), [power])
  const statsAll = useMemo(
    () => (history ? analyseHistory(windowHistory(history.all, range), power?.portCount ?? null) : null),
    [history, power, range],
  )
  const statsByKw = useMemo(() => {
    const out: Array<[number, HistoryStats]> = []
    for (const [kw, pts] of history?.byKw ?? []) {
      const s = analyseHistory(windowHistory(pts, range), portsByKw.get(kw) ?? null)
      if (s) out.push([kw, s])
    }
    return out.sort((a, b) => b[0] - a[0])
  }, [history, portsByKw, range])
  const [pickedKw, setPickedKw] = useState<number | null>(null)
  const shown = (pickedKw !== null && statsByKw.find(([kw]) => kw === pickedKw)?.[1]) || statsAll

  if (!historyLoading && !shown && !historyError) return null
  return (
    <section className="mt-3 rounded-xl bg-muted px-3 py-3" aria-label={L.lastHours(range)}>
      <div className="flex items-center gap-2 text-sm">
        <BarChart3 className="size-4 shrink-0 text-brand" aria-hidden />
        <span className="font-semibold">{L.lastHours(range)}</span>
        <div role="radiogroup" aria-label={L.range} className="ml-auto flex rounded-full bg-background/70 p-0.5">
          {HISTORY_RANGES.map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={range === h}
              onClick={() => setRange(h)}
              className={`h-6 rounded-full px-2.5 text-xs font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/50 ${
                range === h ? 'bg-brand text-brand-foreground' : 'text-muted-foreground'
              }`}
            >
              {h}h
            </button>
          ))}
        </div>
      </div>
      {statsByKw.length >= 2 && (
        <div data-vaul-no-drag className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar">
          <Chip size="sm" selected={pickedKw === null} onClick={() => setPickedKw(null)}>
            {L.all}
          </Chip>
          {statsByKw.map(([kw]) => (
            <Chip key={kw} size="sm" selected={pickedKw === kw} onClick={() => setPickedKw(kw)}>
              {fmtKw(kw)} kW
            </Chip>
          ))}
        </div>
      )}
      {/* Giữ sẵn chiều cao: biểu đồ về sau (WebSocket) không làm bảng giật lên. */}
      <div className="min-h-[176px]">
        {shown ? (
          <>
            <div className="mt-3 flex items-end gap-3">
              {shown.fillRate !== null && <FillRing rate={shown.fillRate} />}
              <HourChart stats={shown} range={range} />
            </div>
            <BottomStats stats={shown} />
            {shown.coverage < 0.95 && <p className="mt-1 text-xs text-amber-600">{L.missing(shown.deadMinutes, range)}</p>}
          </>
        ) : historyError ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {historyError === UNAVAILABLE ? L.noHistory : L.historyFailed(historyError)}
          </p>
        ) : (
          <div className="mt-3 h-[160px] animate-pulse rounded-lg bg-background/60" />
        )}
      </div>
    </section>
  )
}

/** Vòng lấp đầy: cung brand mảnh trên nền nhạt, số % ở giữa — vòng mảnh + bán kính lớn để lòng vòng rộng. */
function FillRing({ rate }: { rate: number }) {
  const pct = Math.round(Math.min(1, rate) * 100)
  const r = 37
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-[108px] shrink-0">
      <svg viewBox="0 0 84 84" className="size-full -rotate-90" aria-hidden>
        <circle cx="42" cy="42" r={r} fill="none" strokeWidth="6" className="stroke-brand/15" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(c * pct) / 100} ${c}`}
          className="stroke-brand transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl leading-none font-bold tabular-nums">{pct}%</span>
        <span className="mt-1 flex items-center gap-0.5 text-[11px] text-muted-foreground" title={L.fillHint}>
          {L.fill} <Info className="size-3" aria-label={L.fillHint} />
        </span>
      </div>
    </div>
  )
}

/**
 * Cột theo giờ (giờ Việt Nam): trung bình số xe đang sạc trong giờ đó. 24h xếp 0h→23h; 6h/12h
 * xếp theo thời gian, kết thúc ở giờ hiện tại. Cột giờ đông nhất tô đậm, kèm nhãn số xe.
 */
function HourChart({ stats, range }: { stats: HistoryStats; range: HistoryRange }) {
  const nowHour = new Date(Date.now() + 7 * 3600_000).getUTCHours()
  const slots =
    range === 24
      ? stats.byHour
      : Array.from({ length: range }, (_, i) => stats.byHour[(nowHour - range + 1 + i + 24) % 24])
  const max = Math.max(1, ...slots.map((s) => s.avg ?? 0))
  const avgPct = Math.min(100, (stats.avg / max) * 100)
  const ticks =
    range === 24
      ? ['0h', '6h', '12h', '18h', '23h']
      : [slots[0], slots[Math.floor(slots.length / 2)], slots[slots.length - 1]].map((s) => `${s.hour}h`)
  return (
    <div className="min-w-0 flex-1" role="img" aria-label={L.chartLabel(stats.peak)}>
      {/* pt chừa chỗ cho nhãn trên cột cao nhất. */}
      <div className="h-[104px] pt-6">
        <div className="relative flex h-full items-end gap-[2px]">
          {/* Đường trung bình cả khoảng — cùng đơn vị với cột (xe trung bình); số ở đầu đường. */}
          <div
            className="pointer-events-none absolute inset-x-0 z-[1] flex items-center"
            style={{ bottom: `${avgPct}%`, transform: 'translateY(50%)' }}
          >
            <span className="shrink-0 rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white tabular-nums">
              {L.avgShort(stats.avg.toFixed(1))}
            </span>
            <span aria-hidden className="flex-1 border-t border-dashed border-rose-500" />
          </div>
          {slots.map((s, i) => {
            const h = s.avg === null ? 0 : Math.max(4, (s.avg / max) * 100)
            const isPeak = s.hour === stats.peakHour && s.avg !== null
            // Nhãn ở mép thì neo vào mép, khỏi tràn khỏi khung.
            const anchor = i < 2 ? 'left-0' : i > slots.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'
            return (
              <div key={s.hour} className="relative flex h-full flex-1 items-end">
                {isPeak && (
                  <span
                    className={`absolute z-[2] rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-brand-foreground ${anchor}`}
                    style={{ bottom: `calc(${h}% + 4px)` }}
                  >
                    {L.cars(s.avg!.toFixed(1))}
                  </span>
                )}
                <div
                  title={s.avg === null ? L.noData(s.hour) : L.hourAvg(s.hour, s.avg.toFixed(1))}
                  className={`w-full rounded-t-[3px] ${
                    s.avg === null ? 'bg-foreground/10' : isPeak ? 'bg-brand' : s.hour === nowHour ? 'bg-brand/70' : 'bg-brand/40'
                  }`}
                  style={{ height: s.avg === null ? 3 : `${h}%` }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        {ticks.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  )
}

/** Hàng dưới: giờ đông nhất / vắng nhất, mỗi ô một icon. */
function BottomStats({ stats }: { stats: HistoryStats }) {
  const items = [
    { solid: true, label: L.busiest, value: stats.peakHour !== null ? `${stats.peakHour}h` : '—' },
    { solid: false, label: L.quietest, value: stats.quietHour !== null ? `${stats.quietHour}h` : '—' },
  ]
  return (
    <dl className="mt-3 grid grid-cols-2 divide-x divide-border rounded-xl bg-background/70 py-2">
      {items.map(({ solid, label, value }) => (
        <div key={label} className="flex min-w-0 items-center gap-2.5 px-3 whitespace-nowrap">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/12 text-brand">
            <Zap className="size-4" fill={solid ? 'currentColor' : 'none'} aria-hidden />
          </span>
          <div className="min-w-0">
            <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
            <dd className="text-sm font-bold tabular-nums">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  )
}

function clock(t: number): string {
  return new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
}
