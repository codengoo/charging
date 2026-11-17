import { useState } from 'react'
import { Navigation, Plus } from 'lucide-react'
import { Chip } from '@/components/ui/chip'
import { placeName, type Place } from '../data/places'
import { distanceKm, type GeoPoint } from '../lib/geo'
import { pick } from '../i18n'
import { placeIcon } from './PlacesSheet'

const L = pick({
  vi: {
    from: 'Từ',
    to: 'Tới',
    me: 'Vị trí của tôi',
    add: 'Địa điểm',
    setup: 'Lưu Nhà, Công ty… để tìm đường nhanh',
  },
  en: {
    from: 'From',
    to: 'To',
    me: 'My location',
    add: 'Place',
    setup: 'Save Home, Work… for quick routes',
  },
})

/** Trong chừng này km coi là đúng địa điểm đã lưu (tên chặng hành trình hiện "Nhà" thay địa chỉ). */
const SAME_PLACE_KM = 0.1

/** Tên hiện cho một chặng: trùng địa điểm đã lưu thì lấy tên địa điểm. */
export function stopLabel(stop: GeoPoint & { label: string }, places: Place[]): string {
  const hit = places.find((p) => distanceKm(p.lat, p.lng, stop.lat, stop.lng) <= SAME_PLACE_KM)
  return hit ? placeName(hit) : stop.label
}

/**
 * Chọn nhanh hành trình từ địa điểm đã lưu: "Từ" (vị trí của tôi / địa điểm) và "Tới" — bấm "Tới"
 * là tìm đường luôn. Chưa có địa điểm nào → một chip mời lưu.
 */
export function PlaceChips({
  places,
  onRoute,
  onManage,
}: {
  places: Place[]
  onRoute: (to: Place, from: Place | null) => void
  onManage: () => void
}) {
  const [fromId, setFromId] = useState<string | null>(null)
  const from = places.find((p) => p.id === fromId) ?? null

  if (places.length === 0) {
    return (
      <Chip size="sm" variant="outline" className="self-start" onClick={onManage}>
        <Plus />
        {L.setup}
      </Chip>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Row label={L.from}>
        <Chip size="sm" variant="outline" selected={!from} onClick={() => setFromId(null)}>
          <Navigation />
          {L.me}
        </Chip>
        {places.map((p) => (
          <PlaceChip key={p.id} place={p} selected={p.id === fromId} onClick={() => setFromId(p.id)} />
        ))}
      </Row>
      <Row label={L.to}>
        {places
          .filter((p) => p.id !== fromId)
          .map((p) => (
            <PlaceChip key={p.id} place={p} onClick={() => onRoute(p, from)} />
          ))}
        <Chip size="sm" variant="outline" onClick={onManage}>
          <Plus />
          {L.add}
        </Chip>
      </Row>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 shrink-0 text-xs text-muted-foreground">{label}</span>
      {/* Vuốt ngang khi nhiều địa điểm; -my/py chừa chỗ cho bóng chip. */}
      <div className="-my-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 no-scrollbar">{children}</div>
    </div>
  )
}

function PlaceChip({ place, selected, onClick }: { place: Place; selected?: boolean; onClick: () => void }) {
  const Icon = placeIcon(place.kind)
  return (
    <Chip size="sm" variant="outline" selected={selected} onClick={onClick} className="shrink-0">
      <Icon />
      {placeName(place)}
    </Chip>
  )
}
