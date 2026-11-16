import { useEffect, useState, type FormEvent } from 'react'
import { ChevronUp, ClipboardPaste, Loader2, Route, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { fmtDistance, fmtKw } from '@/lib/format'
import type { RouteHits } from '../data/routeCorridor'
import { TRIP_RADII, type TripRadius, type TripState } from '../data/useTrip'
import type { Station, StationPower } from '../data/types'
import { tierOf } from '../data/stations'
import { TIER_COLORS } from '../map/pins'

interface Props {
  trip: TripState
  hits: RouteHits
  power: Map<string, StationPower> | null
  /** Đang mở chi tiết trạm: tự thu bảng xuống để không che (giống `detailOpen` bên Android). */
  stationOpen: boolean
  onOpen: (text: string) => void
  onRadius: (km: TripRadius) => void
  onPick: (st: Station) => void
  onClose: () => void
}

/**
 * Bảng "Trạm dọc đường". KHÔNG phải hộp thoại modal: bản đồ phía sau vẫn kéo/zoom được để xem
 * tuyến, và bảng chi tiết trạm mở đè lên được. Điện thoại: dải dưới đáy, bấm tay cầm để thu/mở.
 * Màn rộng: thẻ nổi góc trái.
 */
export function TripPanel({ trip, hits, power, stationOpen, onOpen, onRadius, onPick, onClose }: Props) {
  const [text, setText] = useState(trip.link ?? '')
  const [expanded, setExpanded] = useState(true)
  // Link đổi từ ngoài (mở /trip?link=…, share target) → ô nhập theo.
  useEffect(() => setText(trip.link ?? ''), [trip.link])
  useEffect(() => {
    if (stationOpen) setExpanded(false)
  }, [stationOpen])

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
      aria-label="Trạm dọc đường"
      className="absolute inset-x-0 bottom-0 z-[6] flex max-h-[60dvh] flex-col rounded-t-2xl bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.12)] sm:inset-x-auto sm:bottom-14 sm:left-3 sm:max-h-[calc(100dvh-11rem)] sm:w-[380px] sm:rounded-2xl sm:shadow-xl"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Thu bảng trạm dọc đường' : 'Mở bảng trạm dọc đường'}
        className="flex justify-center pt-2 pb-1 sm:hidden"
      >
        <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
      </button>

      <header className="flex items-center gap-2 px-4 pt-1 sm:pt-3">
        <Route className="size-5 shrink-0 text-brand" aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-base font-bold">
          {trip.stops.length > 1 ? trip.stops.map((s) => s.label).join(' → ') : 'Trạm dọc đường'}
        </h2>
        {!expanded && (
          <Button variant="ghost" size="icon-sm" aria-label="Mở bảng" onClick={() => setExpanded(true)}>
            <ChevronUp />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Đóng hành trình" onClick={onClose}>
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
              placeholder="Dán link chỉ đường Google Maps"
              aria-label="Link Google Maps"
              className="min-w-0"
              inputMode="url"
            />
            <Button type="button" variant="outline" size="icon" aria-label="Dán từ bộ nhớ tạm" onClick={paste}>
              <ClipboardPaste />
            </Button>
            <Button type="submit" variant="brand" disabled={!text.trim() || busy}>
              Tìm
            </Button>
          </form>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Cách tuyến</span>
            {TRIP_RADII.map((km) => (
              <Chip key={km} size="sm" selected={trip.radiusKm === km} onClick={() => onRadius(km)}>
                {km} km
              </Chip>
            ))}
          </div>

          {hits.items.length > 0 && (
            <ul className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4" aria-label="Trạm theo thứ tự trên đường">
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
                          cách tuyến {fmtDistance(offsetKm)}
                          {p ? ` · tối đa ${fmtKw(p.maxKw)} kW` : ''}
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
      return 'Đang đọc liên kết…'
    case 'routing':
      return 'Đang tính đường và tìm trạm…'
    case 'error':
      return trip.error ?? 'Có lỗi xảy ra.'
    case 'ready': {
      const r = trip.route
      if (!r) return ''
      const via = trip.stops.length > 2 ? `qua ${trip.stops.length - 2} điểm dừng · ` : ''
      const count = `${hits.total} trạm trong ${trip.radiusKm} km`
      const cap = hits.total > hits.items.length ? ` (hiện ${hits.items.length} trạm sát tuyến nhất)` : ''
      return `${via}${Math.round(r.meters / 1000)} km · ${fmtDuration(r.seconds)} · ${count}${cap}`
    }
    default:
      return 'Mở Google Maps, chỉ đường rồi bấm Chia sẻ → Trạm sạc, hoặc dán link vào đây.'
  }
}

function fmtDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} phút`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} giờ ${m % 60} phút` : `${h} giờ`
}
