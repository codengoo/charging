import { useMemo, useState } from 'react'
import { Activity, Clock, RefreshCw, Wrench } from 'lucide-react'
import { Chip } from '@/components/ui/chip'
import { Button } from '@/components/ui/button'
import { fmtKw } from '@/lib/format'
import { analyseHistory, estimateFromHistory, type HistoryStats, type LiveState } from '../data/live'
import type { StationPower } from '../data/types'

/**
 * Khối thời gian thực trong bảng trạm — port EvcsSection của app Android:
 *   1. Số cổng trống theo từng mức kW (EVCS, gần như tức thời), số xe đang sạc, cổng bảo trì.
 *   2. Dự báo xe sắp sạc xong (nếu EVCS cho khách vãng lai xem).
 *   3. "24 giờ qua": số xe đang sạc theo giờ, cao điểm / vắng nhất, tỉ lệ lấp đầy.
 * Lỗi lần hỏi nói rõ + nút thử lại — khác với "trạm không có số liệu".
 */
export function LiveSection({ live, power }: { live: LiveState; power?: StationPower }) {
  const { live: st, liveLoading, liveError, history, historyLoading, historyError, retry } = live

  const portsByKw = useMemo(() => new Map((power?.groups ?? []).map((g) => [g.kw, g.count])), [power])
  const statsAll = useMemo(
    () => (history ? analyseHistory(history.all, power?.portCount ?? null) : null),
    [history, power],
  )
  const statsByKw = useMemo(() => {
    const out: Array<[number, HistoryStats]> = []
    for (const [kw, pts] of history?.byKw ?? []) {
      const s = analyseHistory(pts, portsByKw.get(kw) ?? null)
      if (s) out.push([kw, s])
    }
    return out.sort((a, b) => b[0] - a[0])
  }, [history, portsByKw])
  // /charging hỏng (thường do EVCS chặn) → ước tính từ điểm cuối của lịch sử 24h.
  const estimate = useMemo(
    () => (!st && liveError ? estimateFromHistory(history, power?.groups ?? []) : null),
    [st, liveError, history, power],
  )
  const [pickedKw, setPickedKw] = useState<number | null>(null)
  const shown = (pickedKw !== null && statsByKw.find(([kw]) => kw === pickedKw)?.[1]) || statsAll

  return (
    <section className="mt-3 rounded-xl bg-muted px-3 py-2.5" aria-label="Cổng trống lúc này">
      <div className="flex items-center gap-2 text-sm">
        <Activity className="size-4 shrink-0 text-brand" aria-hidden />
        <span className="font-semibold">Cổng trống lúc này</span>
        {liveLoading && <span className="text-muted-foreground">· đang lấy…</span>}
        {st && !liveLoading && <span className="text-muted-foreground">· cập nhật {clock(st.at)}</span>}
      </div>

      {estimate && (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {estimate.ports.map((p) => (
              <Chip key={p.kw} size="sm" variant="outline">
                <span className="font-semibold">{fmtKw(p.kw)} kW</span>
                <span className="text-muted-foreground">
                  trống ~<span className={p.free > 0 ? 'font-semibold text-brand' : 'font-semibold'}>{p.free}</span>/{p.total}
                </span>
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Ước tính từ số xe đang sạc lúc {clock(estimate.at)} ({estimate.charging} xe) — chưa trừ cổng hỏng / đặt trước.
          </p>
        </>
      )}
      {liveError && !estimate && !historyLoading && (
        <ErrorRow text={`${liveError} — chưa lấy được số cổng trống`} onRetry={retry} />
      )}

      {st?.maintenance && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
          <Wrench className="size-4" aria-hidden /> Trạm đang bảo trì.
        </p>
      )}

      {st && st.ports.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {st.ports.map((p) => (
            <Chip
              key={p.kw}
              size="sm"
              variant="outline"
              className={p.free === 0 ? 'border-destructive/40 text-destructive' : ''}
            >
              <span className="font-semibold">{fmtKw(p.kw)} kW</span>
              <span className={p.free === 0 ? '' : 'text-muted-foreground'}>
                trống <span className={p.free > 0 ? 'font-semibold text-brand' : 'font-semibold'}>{p.free}</span>/{p.total}
              </span>
            </Chip>
          ))}
        </div>
      )}
      {st && st.ports.length === 0 && !st.maintenance && (
        <p className="mt-1.5 text-sm text-muted-foreground">Trạm này không báo số cổng trống.</p>
      )}
      {st && (st.charging > 0 || st.maintPorts > 0) && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {st.charging > 0 && `${st.charging} xe đang sạc`}
          {st.charging > 0 && st.maintPorts > 0 && ' · '}
          {st.maintPorts > 0 && `${st.maintPorts} cổng bảo trì / tạm khoá`}
        </p>
      )}

      {st && st.forecast.length > 0 && (
        <div className="mt-2 flex gap-2 rounded-lg bg-brand/10 px-2.5 py-2 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          <div>
            {st.forecast.map((f, i) => (
              <p key={i} className="font-medium">
                {f.cars} xe đang sạc trụ {fmtKw(f.kw)} kW sẽ xong sau{' '}
                {f.minMinutes === f.maxMinutes ? `${f.minMinutes}p` : `${f.minMinutes}–${f.maxMinutes}p`}
              </p>
            ))}
            <p className="text-xs text-muted-foreground">Dự báo thống kê, không phải số đo.</p>
          </div>
        </div>
      )}

      {(historyLoading || shown || historyError) && (
        <div className="mt-3 border-t border-background pt-2.5">
          <p className="text-sm font-semibold">24 giờ qua</p>
          {statsByKw.length >= 2 && (
            <div data-vaul-no-drag className="mt-1.5 flex gap-1.5 overflow-x-auto no-scrollbar">
              <Chip size="sm" selected={pickedKw === null} onClick={() => setPickedKw(null)}>
                Tất cả
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
                {shown.coverage < 0.95 && (
                  <p className="mt-1 text-xs text-amber-600">
                    Thiếu {shown.deadMinutes} phút dữ liệu trong 24h — đã loại khỏi thống kê.
                  </p>
                )}
              </>
            ) : historyError ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {historyError === 'Trạm không có số liệu' ? 'Trạm này không có lịch sử 24h.' : `${historyError} — chưa lấy được lịch sử.`}
              </p>
            ) : (
              <div className="mt-2 h-[92px] animate-pulse rounded-lg bg-background/60" />
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function ErrorRow({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="mt-1.5 flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>{text}</span>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        <RefreshCw /> Thử lại
      </Button>
    </div>
  )
}

/** Cột theo giờ (giờ Việt Nam): trung bình số xe đang sạc trong giờ đó. */
function HourChart({ stats }: { stats: HistoryStats }) {
  const max = Math.max(1, ...stats.byHour.map((s) => s.avg ?? 0))
  const nowHour = new Date(Date.now() + 7 * 3600_000).getUTCHours()
  return (
    <div className="mt-2" role="img" aria-label={`Số xe đang sạc theo giờ, cao nhất ${stats.peak} xe`}>
      <div className="flex h-[72px] items-end gap-[2px]">
        {stats.byHour.map((s) => (
          <div
            key={s.hour}
            title={s.avg === null ? `${s.hour}h: không có dữ liệu` : `${s.hour}h: ~${s.avg.toFixed(1)} xe`}
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
    ['Cao nhất', `${stats.peak} xe`],
    ['Trung bình', `${stats.avg.toFixed(1)} xe`],
  ]
  if (stats.fillRate !== null) items.push(['Lấp đầy', `${Math.round(Math.min(1, stats.fillRate) * 100)}%`])
  if (stats.peakHour !== null) items.push(['Đông nhất', `${stats.peakHour}h`])
  if (stats.quietHour !== null) items.push(['Vắng nhất', `${stats.quietHour}h`])
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
  return new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
