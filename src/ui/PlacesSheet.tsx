import { BriefcaseBusiness, House, MapPin, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLACES_CUSTOM_MAX, newPlaceId, placeName, type Place, type PlaceKind } from '../data/places'
import { pick } from '../i18n'
import { AppSheet } from './AppSheet'
import { SwipeToDelete } from './SwipeToDelete'
import type { PlaceEditTarget } from './PlaceEditorPanel'

const L = pick({
  vi: {
    title: 'Địa điểm của tôi',
    hint: 'Lưu sẵn để tìm đường và trạm dọc đường nhanh hơn, và xem trạm gần đó. Chỉ lưu trên máy này.',
    notSet: 'Chưa đặt — chạm để chọn',
    add: 'Thêm địa điểm',
    full: `Tối đa ${PLACES_CUSTOM_MAX} địa điểm tự đặt.`,
    remove: (n: string) => `Xoá ${n}`,
  },
  en: {
    title: 'My places',
    hint: 'Saved for quicker routes and along-route stations, and to see stations nearby. Stored on this device only.',
    notSet: 'Not set — tap to choose',
    add: 'Add a place',
    full: `Up to ${PLACES_CUSTOM_MAX} custom places.`,
    remove: (n: string) => `Remove ${n}`,
  },
})

interface Props {
  open: boolean
  onClose: () => void
  places: Place[]
  onRemove: (id: string) => void
  /** Bấm một hàng / "Thêm địa điểm" → App mở màn đặt địa điểm (chọn trên bản đồ). */
  onEdit: (t: PlaceEditTarget) => void
  /** Mở chồng trên bảng khác (Cài đặt). */
  nested?: boolean
}

const ICON: Record<PlaceKind, typeof House> = { home: House, work: BriefcaseBusiness, custom: MapPin }
export const placeIcon = (kind: PlaceKind) => ICON[kind]

/** Mục tiêu sửa cho một địa điểm có sẵn / ô trống / địa điểm tự đặt mới. */
export function editTargetOf(kind: PlaceKind, p?: Place): PlaceEditTarget {
  return {
    id: p?.id ?? (kind === 'custom' ? newPlaceId() : kind),
    kind,
    name: p?.name ?? '',
    hit: p ? { label: p.address || placeName(p), address: '', lat: p.lat, lng: p.lng } : null,
    isNew: !p,
  }
}

/** Bảng "Địa điểm của tôi": Nhà / Công ty / tự đặt. Đặt chỗ ở PlaceEditorPanel (App mở). */
export function PlacesSheet({ open, onClose, places, onRemove, onEdit, nested }: Props) {
  const byId = new Map(places.map((p) => [p.id, p]))
  const custom = places.filter((p) => p.kind === 'custom')

  return (
    <AppSheet open={open} onClose={onClose} nested={nested} title={L.title} description={L.hint} autoFocus={false}>
      <div className="mt-2 flex flex-col gap-2">
        {(['home', 'work'] as const).map((k) => (
          <PlaceRow key={k} kind={k} place={byId.get(k)} onEdit={() => onEdit(editTargetOf(k, byId.get(k)))} onRemove={() => onRemove(k)} />
        ))}
        {custom.map((p) => (
          <PlaceRow key={p.id} kind="custom" place={p} onEdit={() => onEdit(editTargetOf('custom', p))} onRemove={() => onRemove(p.id)} />
        ))}
        {custom.length < PLACES_CUSTOM_MAX ? (
          <Button variant="outline" className="h-11 justify-start gap-3 rounded-xl" onClick={() => onEdit(editTargetOf('custom'))}>
            <Plus className="size-5 text-brand" aria-hidden />
            {L.add}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">{L.full}</p>
        )}
      </div>
    </AppSheet>
  )
}

function PlaceRow({ kind, place, onEdit, onRemove }: { kind: PlaceKind; place?: Place; onEdit: () => void; onRemove: () => void }) {
  const Icon = ICON[kind]
  const name = place ? placeName(place) : placeName({ kind, name: '' })
  const row = (
    <div className="flex items-center gap-1 rounded-xl bg-muted pr-2.5">
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left outline-none">
        <Icon className="size-5 shrink-0 text-brand" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-medium">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{place ? place.address : L.notSet}</span>
        </span>
      </button>
      {place && (
        // Cảm ứng (điện thoại, tablet): ẩn — vuốt sang trái để xoá; chuột / bàn phím vẫn dùng nút.
        <Button variant="ghost" size="icon-sm" className="pointer-coarse:hidden" aria-label={L.remove(name)} onClick={onRemove}>
          <Trash2 />
        </Button>
      )}
    </div>
  )
  // Đã đặt thì vuốt phải → trái để xoá (nút thùng rác vẫn giữ cho màn rộng / bàn phím).
  return place ? <SwipeToDelete onDelete={onRemove}>{row}</SwipeToDelete> : row
}
