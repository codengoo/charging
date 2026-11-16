import { useMemo, useState } from 'react'
import { BarChart3, Clock, PlugZap, RefreshCw, Wrench } from 'lucide-react'
import { Chip } from '@/components/ui/chip'
import { Button } from '@/components/ui/button'
import { fmtKw } from '@/lib/format'
import { LOCALE, pick } from '@/i18n'
import { UNAVAILABLE, analyseHistory, estimateFromHistory, type HistoryStats, type LivePorts, type LiveState } from '../data/live'
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
    last24h: '24 giờ qua',
    all: 'Tất cả',
    noHistory: 'Trạm này không có lịch sử 24h.',
    historyFailed: (e: string) => `${e} — chưa lấy được lịch sử.`,
    missing: (m: number) => `Thiếu ${m} phút dữ liệu trong 24h — đã loại khỏi thống kê.`,
    chartLabel: (peak: number) => `Số xe đang sạc theo giờ, cao nhất ${peak} xe`,
    noData: (h: number) => `${h}h: không có dữ liệu`,
    hourAvg: (h: number, v: string) => `${h}h: ~${v} xe`,
    peak: 'Cao nhất',
    avg: 'Trung bình',
    fill: 'Lấp đầy',
    busiest: 'Đông nhất',
    quietest: 'Vắng nhất',
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
    last24h: 'Last 24 hours',
    all: 'All',
    noHistory: 'No 24-hour history for this station.',
    historyFailed: (e: string) => `${e} — couldn't load history.`,
    missing: (m: number) => `${m} minutes of data missing in 24h — excluded from stats.`,
    chartLabel: (peak: number) => `Cars charging by hour, peak ${peak}`,
    noData: (h: number) => `${h}:00: no data`,
    hourAvg: (h: number, v: string) => `${h}:00: ~${v} cars`,
    peak: 'Peak',
    avg: 'Average',
    fill: 'Occupancy',
    busiest: 'Busiest',
    quietest: 'Quietest',
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
        <div className="mt-2 flex flex-wrap gap-1.5">
          {rows.map((r) => (
            <PortChip key={r.kw} row={r} approx={approx} />
          ))}
        </div>
      )}

      {live && (
        <div className="mt-1.5 flex flex-col gap-1 text-xs text-muted-foreground">
          {status && <span>{status}</span>}
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
 * Chip = thanh tiến độ: nền tô theo tỉ lệ cổng ĐANG CẮM / tổng của mức kW đó. Chưa có số
 * realtime thì là chip thường "× N"; có rồi thì tô dần. Đầy (hết cổng trống) tô kín.
 */
const FULL_RED = '#E53935'

function PortChip({ row: r, approx }: { row: Row; approx: boolean }) {
  const hasLive = r.free !== null && r.total !== null && r.total > 0
  const used = hasLive ? r.total! - r.free! : 0
  const pct = hasLive ? Math.round((used / r.total!) * 100) : 0
  const full = hasLive && used >= r.total!
  // Hết cổng trống: cả chip chuyển đỏ, bất kể màu của mức kW — nhìn lướt là biết "đầy".
  const color = full ? FULL_RED : kwColor(r.kw, r.dc)
  return (
    <span
      className="relative inline-flex h-7 shrink-0 items-center gap-1.5 overflow-hidden rounded-full border bg-card px-3 text-xs whitespace-nowrap"
      style={{ borderColor: `${color}66` }}
      role={hasLive ? 'meter' : undefined}
      aria-valuemin={hasLive ? 0 : undefined}
      aria-valuemax={hasLive ? r.total! : undefined}
      aria-valuenow={hasLive ? used : undefined}
    >
      {hasLive && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 transition-[width] duration-500"
          style={{ width: `${pct}%`, background: `${color}${full ? '40' : '26'}` }}
        />
      )}
      <span className="relative font-semibold" style={{ color }}>
        {fmtKw(r.kw)} kW
      </span>
      {hasLive ? (
        <span className="relative" style={full ? { color } : undefined}>
          <span className={full ? '' : 'text-muted-foreground'}>{L.inUse} {approx && '~'}</span>
          <span className={full ? 'font-semibold' : 'font-semibold text-foreground'}>{used}</span>
          <span className={full ? '' : 'text-muted-foreground'}>/{r.total}</span>
        </span>
      ) : (
        <span className="relative text-muted-foreground">× {r.count}</span>
      )}
      {r.dc !== null && (
        <span className={full ? 'relative' : 'relative text-muted-foreground'} style={full ? { color } : undefined}>
          · {r.dc ? 'DC' : 'AC'}
        </span>
      )}
    </span>
  )
}

/** Khối riêng "24 giờ qua": biểu đồ số xe theo giờ + các ô thống kê. */
export function HistoryBox({ live, power }: { live: LiveState; power?: StationPower }) {
  const { history, historyLoading, historyError } = live
  const portsByKw = useMemo(() => new Map((power?.groups ?? []).map((g) => [g.kw, g.count])), [power])
  const statsAll = useMemo(() => (history ? analyseHistory(history.all, power?.portCount ?? null) : null), [history, power])
  const statsByKw = useMemo(() => {
    const out: Array<[number, HistoryStats]> = []
    for (const [kw, pts] of history?.byKw ?? []) {
      const s = analyseHistory(pts, portsByKw.get(kw) ?? null)
      if (s) out.push([kw, s])
    }
    return out.sort((a, b) => b[0] - a[0])
  }, [history, portsByKw])
  const [pickedKw, setPickedKw] = useState<number | null>(null)
  const shown = (pickedKw !== null && statsByKw.find(([kw]) => kw === pickedKw)?.[1]) || statsAll

  if (!historyLoading && !shown && !historyError) return null
  return (
    <section className="mt-3 rounded-xl bg-muted px-3 py-2.5" aria-label={L.last24h}>
      <div className="flex items-center gap-2 text-sm">
        <BarChart3 className="size-4 shrink-0 text-brand" aria-hidden />
        <span className="font-semibold">{L.last24h}</span>
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
      <div className="min-h-[148px]">
        {shown ? (
          <>
            <HourChart stats={shown} />
            <StatRow stats={shown} />
            {shown.coverage < 0.95 && <p className="mt-1 text-xs text-amber-600">{L.missing(shown.deadMinutes)}</p>}
          </>
        ) : historyError ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {historyError === UNAVAILABLE ? L.noHistory : L.historyFailed(historyError)}
          </p>
        ) : (
          <div className="mt-2 h-[92px] animate-pulse rounded-lg bg-background/60" />
        )}
      </div>
    </section>
  )
}

/** Cột theo giờ (giờ Việt Nam): trung bình số xe đang sạc trong giờ đó. */
function HourChart({ stats }: { stats: HistoryStats }) {
  const max = Math.max(1, ...stats.byHour.map((s) => s.avg ?? 0))
  const nowHour = new Date(Date.now() + 7 * 3600_000).getUTCHours()
  return (
    <div className="mt-2" role="img" aria-label={L.chartLabel(stats.peak)}>
      <div className="flex h-[72px] items-end gap-[2px]">
        {stats.byHour.map((s) => (
          <div
            key={s.hour}
            title={s.avg === null ? L.noData(s.hour) : L.hourAvg(s.hour, s.avg.toFixed(1))}
            className={`flex-1 rounded-t-[2px] ${
              s.avg === null ? 'bg-foreground/10' : s.hour === nowHour ? 'bg-brand' : 'bg-brand/45'
            }`}
            style={{ height: s.avg === null ? 3 : `${Math.max(4, (s.avg / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  )
}

function StatRow({ stats }: { stats: HistoryStats }) {
  const items: Array<[string, string]> = [
    [L.peak, L.cars(String(stats.peak))],
    [L.avg, L.cars(stats.avg.toFixed(1))],
  ]
  if (stats.fillRate !== null) items.push([L.fill, `${Math.round(Math.min(1, stats.fillRate) * 100)}%`])
  if (stats.peakHour !== null) items.push([L.busiest, `${stats.peakHour}h`])
  if (stats.quietHour !== null) items.push([L.quietest, `${stats.quietHour}h`])
  return (
    <dl className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg bg-background/70 px-2 py-1.5">
          <dt className="text-[11px] text-muted-foreground">{k}</dt>
          <dd className="text-sm font-semibold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function clock(t: number): string {
  return new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
}
