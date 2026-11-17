import { useEffect, useState } from 'react'
import { BriefcaseBusiness, House, MapPin, Navigation, Pencil, Zap } from 'lucide-react'
import { placeName, type Place, type PlaceKind } from '../data/places'
import { reverse } from '../data/trip'
import type { GeoPoint } from '../lib/geo'
import { pick } from '../i18n'
import { AppSheet } from './AppSheet'

const L = pick({
  vi: {
    here: 'Chỗ này',
    finding: 'Đang tìm tên chỗ…',
    route: 'Tìm đường tới đây',
    routeHint: 'Từ vị trí của bạn — kèm trạm sạc dọc đường',
    nearby: 'Trạm gần đây',
    saveHome: 'Lưu làm Nhà',
    saveWork: 'Lưu làm Công ty',
    saveOther: 'Lưu thành địa điểm khác…',
    replace: (n: string) => `Thay ${n} đã lưu`,
    edit: 'Sửa trong Địa điểm của tôi',
  },
  en: {
    here: 'This spot',
    finding: 'Looking up this place…',
    route: 'Directions to here',
    routeHint: 'From your location — with charging stations along the way',
    nearby: 'Stations nearby',
    saveHome: 'Save as Home',
    saveWork: 'Save as Work',
    saveOther: 'Save as another place…',
    replace: (n: string) => `Replaces your saved ${n}`,
    edit: 'Edit in My places',
  },
})

interface Props {
  open: boolean
  onClose: () => void
  /** Điểm chạm giữ, hoặc toạ độ của địa điểm đã lưu khi bấm vào ghim của nó. */
  point: GeoPoint | null
  /** Bấm vào ghim địa điểm đã lưu. */
  place: Place | null
  places: Place[]
  onRoute: (p: GeoPoint, label: string) => void
  onNearby: (p: GeoPoint, label: string) => void
  onSave: (kind: PlaceKind, p: GeoPoint, label: string) => void
  onEditPlaces: () => void
}

/** Bảng nhỏ khi chạm giữ bản đồ / bấm ghim địa điểm: tìm đường, trạm gần, lưu thành địa điểm. */
export function PointSheet({ open, onClose, point, place, places, onRoute, onNearby, onSave, onEditPlaces }: Props) {
  const [label, setLabel] = useState<string | null>(null)

  // Điểm chưa lưu → hỏi HERE tên chỗ (hỏng thì hiện toạ độ).
  useEffect(() => {
    setLabel(null)
    if (!open || !point || place) return
    const ctrl = new AbortController()
    reverse(point, ctrl.signal)
      .then((t) => !ctrl.signal.aborted && setLabel(t ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`))
      .catch(() => !ctrl.signal.aborted && setLabel(`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`))
    return () => ctrl.abort()
  }, [open, point, place])

  if (!point) return null
  const name = place ? placeName(place) : label ?? L.here
  const has = (k: PlaceKind) => places.find((p) => p.kind === k)

  return (
    <AppSheet
      open={open}
      onClose={onClose}
      title={name}
      description={place ? place.address : label ? undefined : L.finding}
      autoFocus={false}
    >
      <div className="mt-2 flex flex-col gap-1.5">
        <Action icon={Navigation} title={L.route} hint={L.routeHint} onClick={() => onRoute(point, name)} primary />
        <Action icon={Zap} title={L.nearby} onClick={() => onNearby(point, name)} />
        {place ? (
          <Action icon={Pencil} title={L.edit} onClick={onEditPlaces} />
        ) : (
          <>
            <Action icon={House} title={L.saveHome} hint={has('home') ? L.replace(placeName({ kind: 'home', name: '' })) : undefined} onClick={() => onSave('home', point, name)} />
            <Action icon={BriefcaseBusiness} title={L.saveWork} hint={has('work') ? L.replace(placeName({ kind: 'work', name: '' })) : undefined} onClick={() => onSave('work', point, name)} />
            <Action icon={MapPin} title={L.saveOther} onClick={() => onSave('custom', point, name)} />
          </>
        )}
      </div>
    </AppSheet>
  )
}

function Action({
  icon: Icon,
  title,
  hint,
  onClick,
  primary,
}: {
  icon: typeof House
  title: string
  hint?: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-brand/35 ${
        primary ? 'bg-brand text-white' : 'bg-muted hover:bg-muted/70'
      }`}
    >
      <Icon className={`size-5 shrink-0 ${primary ? '' : 'text-brand'}`} aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-medium">{title}</span>
        {hint && <span className={`text-xs ${primary ? 'text-white/80' : 'text-muted-foreground'}`}>{hint}</span>}
      </span>
    </button>
  )
}
