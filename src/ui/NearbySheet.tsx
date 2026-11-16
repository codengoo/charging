import { useMemo } from 'react'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { FAST_KW, nearestStations, passesFilters, tierOf, type Filters, type StationIndex } from '../data/stations'
import type { Station, StationPower } from '../data/types'
import { TIER_COLORS } from '../map/pins'
import { PinPreview } from './groupIcons'
import { fmtDistance, fmtKw } from '@/lib/format'

/** 20 trạm, quét tối đa 10 vòng ô lưới (~110 km). */
const LIMIT = 20
const MAX_RING = 10

interface Props {
  /** Giữ component gắn và chỉ đổi `open` — gỡ hẳn khi đóng thì mất hiệu ứng trôi xuống. */
  open: boolean
  index: StationIndex
  power: Map<string, StationPower> | null
  filters: Filters
  /** Chụp lúc mở bảng — kéo bản đồ sau bảng thì danh sách không nhảy. */
  origin: { lat: number; lng: number }
  fromGps: boolean
  onPick: (st: Station) => void
  onClose: () => void
}

/** Các trạm đang hoạt động gần nhất, theo đúng bộ lọc công suất đang bật trên bản đồ. */
export function NearbySheet({ open, index, power, filters, origin, fromGps, onPick, onClose }: Props) {
  const items = useMemo(() => {
    // "Đã lưu" bỏ qua ở đây (đã có bảng Danh sách); trạm không hoạt động luôn bỏ — đang cần sạc.
    const f: Filters = { ...filters, favoritesOnly: false, activeOnly: true }
    return nearestStations(index, origin.lat, origin.lng, LIMIT, (st) => passesFilters(st, f, power), MAX_RING)
  }, [index, power, filters, origin])

  const filterLabel =
    filters.power === 'dc' ? 'có sạc nhanh DC' : filters.power === 'dc120' ? `có cổng ≥ ${FAST_KW} kW` : ''

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-lg">
            {fromGps ? 'Trạm gần bạn' : 'Trạm gần tâm bản đồ'}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-sm">
            {items.length === 0
              ? `Không có trạm đang hoạt động${filterLabel ? ` ${filterLabel}` : ''} trong khoảng 110 km.`
              : `${items.length} trạm đang hoạt động${filterLabel ? ` ${filterLabel}` : ''} gần nhất`}
            {!fromGps && ' · Bật định vị để xếp theo chỗ bạn đứng.'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ul className="mt-2 flex flex-col">
          {items.map((st) => {
            const p = power?.get(st.entityId)
            return (
              <li key={st.entityId} className="border-b border-border/60 last:border-b-0">
                <button
                  type="button"
                  className="flex w-full min-w-0 items-center gap-3 py-2.5 text-left"
                  onClick={() => onPick(st)}
                >
                  <PinPreview
                    group={{ iconKey: 'charger', colorHex: TIER_COLORS[tierOf(p)] }}
                    width={24}
                    className="shrink-0"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 text-[15px] leading-snug">{st.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{st.address}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-sm font-semibold">{fmtDistance(st.distanceKm)}</span>
                    {p && <span className="text-xs text-muted-foreground">{fmtKw(p.maxKw)} kW</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
