import { useEffect, useState, type FormEvent } from 'react'
import { ChevronUp, ClipboardPaste, Loader2, Route, X } from 'lucide-react'
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
  /** Mức công suất đang lọc (rỗng = tất cả). Đổi ở đây là đổi luôn Cài đặt hiển thị. */
  kwBands: KwBand[]
  onKwBands: (bands: KwBand[]) => void
  onPick: (st: Station) => void
  onClose: () => void
}

/**
 * Bảng "Trạm dọc đường". KHÔNG phải hộp thoại modal: bản đồ phía sau vẫn kéo/zoom được để xem
 * tuyến, và bảng chi tiết trạm mở đè lên được. Điện thoại: dải dưới đáy, bấm tay cầm để thu/mở.
 * Màn rộng: thẻ nổi góc trái.
 */
export function TripPanel({ trip, hits, power, stationOpen, onOpen, onRadius, kwBands, onKwBands, onPick, onClose }: Props) {
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
      className="absolute inset-x-0 bottom-0 z-[6] flex max-h-[60dvh] flex-col rounded-t-2xl bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.12)] sm:inset-x-auto sm:bottom-14 sm:left-3 sm:max-h-[calc(100dvh-11rem)] sm:w-[380px] sm:rounded-2xl sm:shadow-xl"
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
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-3">
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

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{L.fromRoute}</span>
            {TRIP_RADII.map((km) => (
              <Chip key={km} size="sm" selected={trip.radiusKm === km} onClick={() => onRadius(km)}>
                {km} km
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={L.power}>
            <span className="text-xs text-muted-foreground">{L.power}</span>
            {KW_BANDS.map((b) => (
              <Chip key={b} size="sm" selected={shownBands.includes(b)} onClick={() => toggleBand(b)}>
                {KW_BAND_LABEL[b]}
              </Chip>
            ))}
          </div>

          {hits.items.length > 0 && (
            <ul className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4" aria-label={L.listAria}>
              {hits.items.map(({ station, atKm, offsetKm }) => {
                const p = power?.get(station.entityId)
                return (
                  <li key={station.entityId} className="border-b border-border/60 last:border-b-0">
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
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
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
