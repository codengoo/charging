import { useEffect, useState, type ReactNode } from 'react'
import { BriefcaseBusiness, ChevronLeft, ClipboardPaste, House, Loader2, LocateFixed, MapPin, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PLACES_CUSTOM_MAX, PLACE_NAME_MAX, newPlaceId, placeName, type Place, type PlaceKind } from '../data/places'
import { placeFromLink, reverse, searchAddress, type PlaceHit } from '../data/trip'
import { firstUrl } from '../lib/mapsLink'
import { getPosition, type GeoPoint } from '../lib/geo'
import { pick } from '../i18n'
import { AppSheet } from './AppSheet'
import { SwipeToDelete } from './SwipeToDelete'

const L = pick({
  vi: {
    title: 'Địa điểm của tôi',
    hint: 'Lưu sẵn để tìm đường và trạm dọc đường nhanh hơn, và xem trạm gần đó. Chỉ lưu trên máy này.',
    notSet: 'Chưa đặt — chạm để chọn',
    add: 'Thêm địa điểm',
    full: `Tối đa ${PLACES_CUSTOM_MAX} địa điểm tự đặt.`,
    remove: (n: string) => `Xoá ${n}`,
    editTitle: (n: string) => `Đặt ${n}`,
    newTitle: 'Địa điểm mới',
    back: 'Quay lại',
    name: 'Tên (vd. Quê, Nhà ngoại)',
    search: 'Gõ địa chỉ hoặc dán link Google Maps',
    paste: 'Dán từ bộ nhớ tạm',
    here: 'Dùng vị trí hiện tại',
    locating: 'Đang lấy vị trí…',
    gpsDenied: 'Trình duyệt đang chặn vị trí — bật lại quyền Vị trí cho trang này.',
    gpsFailed: 'Chưa lấy được vị trí, thử lại.',
    noHit: 'Không tìm thấy — thử gõ cụ thể hơn.',
    badLink: 'Không đọc được link này.',
    chosen: 'Đã chọn',
    save: 'Lưu',
  },
  en: {
    title: 'My places',
    hint: 'Saved for quicker routes and along-route stations, and to see stations nearby. Stored on this device only.',
    notSet: 'Not set — tap to choose',
    add: 'Add a place',
    full: `Up to ${PLACES_CUSTOM_MAX} custom places.`,
    remove: (n: string) => `Remove ${n}`,
    editTitle: (n: string) => `Set ${n}`,
    newTitle: 'New place',
    back: 'Back',
    name: 'Name (e.g. Hometown, Grandma)',
    search: 'Type an address or paste a Google Maps link',
    paste: 'Paste from clipboard',
    here: 'Use my current location',
    locating: 'Getting your location…',
    gpsDenied: 'Location is blocked — allow Location for this site.',
    gpsFailed: "Couldn't get your location, try again.",
    noHit: 'Nothing found — try a more specific address.',
    badLink: "Couldn't read this link.",
    chosen: 'Selected',
    save: 'Save',
  },
})

/** Mở thẳng màn sửa với một điểm có sẵn (chạm giữ trên bản đồ). */
export interface PlaceDraft {
  kind: PlaceKind
  lat: number
  lng: number
  label?: string
}

interface Editing {
  id: string
  kind: PlaceKind
  name: string
  hit: PlaceHit | null
}

interface Props {
  open: boolean
  onClose: () => void
  places: Place[]
  onSave: (p: Omit<Place, 'at'>) => void
  onRemove: (id: string) => void
  /** Ưu tiên gợi ý địa chỉ gần đây (vị trí người dùng / tâm bản đồ). */
  near: GeoPoint | null
  draft: PlaceDraft | null
  /** Mở chồng trên bảng khác (Cài đặt). */
  nested?: boolean
}

const ICON: Record<PlaceKind, typeof House> = { home: House, work: BriefcaseBusiness, custom: MapPin }
export const placeIcon = (kind: PlaceKind) => ICON[kind]

/** Bảng "Địa điểm của tôi": danh sách Nhà / Công ty / tự đặt, và màn đặt địa điểm. */
export function PlacesSheet({ open, onClose, places, onSave, onRemove, near, draft, nested }: Props) {
  const [editing, setEditing] = useState<Editing | null>(null)

  // Mở bằng `draft` (chạm giữ bản đồ) → vào thẳng màn đặt với điểm đó; mở thường → danh sách.
  useEffect(() => {
    if (!open) return
    if (!draft) return setEditing(null)
    const id = draft.kind === 'custom' ? newPlaceId() : draft.kind
    const label = draft.label ?? `${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`
    setEditing({ id, kind: draft.kind, name: '', hit: { label, address: '', lat: draft.lat, lng: draft.lng } })
  }, [open, draft])

  const byId = new Map(places.map((p) => [p.id, p]))
  const custom = places.filter((p) => p.kind === 'custom')
  const startEdit = (kind: PlaceKind, p?: Place) =>
    setEditing({
      id: p?.id ?? (kind === 'custom' ? newPlaceId() : kind),
      kind,
      name: p?.name ?? '',
      hit: p ? { label: p.address || placeName(p), address: '', lat: p.lat, lng: p.lng } : null,
    })

  const title = editing
    ? editing.kind === 'custom' && !byId.has(editing.id)
      ? L.newTitle
      : L.editTitle(editing.kind === 'custom' ? editing.name || L.newTitle : placeName(editing))
    : L.title

  return (
    <AppSheet open={open} onClose={onClose} nested={nested} title={title} description={editing ? undefined : L.hint} autoFocus={false}>
      {editing ? (
        <PlaceEditor
          key={editing.id}
          editing={editing}
          near={near}
          onBack={() => setEditing(null)}
          onSave={(e) => {
            const hit = e.hit!
            onSave({ id: e.id, kind: e.kind, name: e.name.trim(), lat: hit.lat, lng: hit.lng, address: hit.address ? `${hit.label}, ${hit.address}` : hit.label })
            if (draft) onClose()
            else setEditing(null)
          }}
        />
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {(['home', 'work'] as const).map((k) => (
            <PlaceRow key={k} kind={k} place={byId.get(k)} onEdit={() => startEdit(k, byId.get(k))} onRemove={() => onRemove(k)} />
          ))}
          {custom.map((p) => (
            <PlaceRow key={p.id} kind="custom" place={p} onEdit={() => startEdit('custom', p)} onRemove={() => onRemove(p.id)} />
          ))}
          {custom.length < PLACES_CUSTOM_MAX ? (
            <Button variant="outline" className="h-11 justify-start gap-3 rounded-xl" onClick={() => startEdit('custom')}>
              <Plus className="size-5 text-brand" aria-hidden />
              {L.add}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">{L.full}</p>
          )}
        </div>
      )}
    </AppSheet>
  )
}

function PlaceRow({ kind, place, onEdit, onRemove }: { kind: PlaceKind; place?: Place; onEdit: () => void; onRemove: () => void }) {
  const Icon = ICON[kind]
  const name = place ? placeName(place) : placeName({ kind, name: '' })
  const row = (
    <div className="flex items-center gap-1 rounded-xl bg-muted pr-1">
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left outline-none">
        <Icon className="size-5 shrink-0 text-brand" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-medium">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{place ? place.address : L.notSet}</span>
        </span>
      </button>
      {place && (
        <Button variant="ghost" size="icon-sm" aria-label={L.remove(name)} onClick={onRemove}>
          <Trash2 />
        </Button>
      )}
    </div>
  )
  // Đã đặt thì vuốt phải → trái để xoá (nút thùng rác vẫn giữ cho màn rộng / bàn phím).
  return place ? <SwipeToDelete onDelete={onRemove}>{row}</SwipeToDelete> : row
}

function PlaceEditor({
  editing,
  near,
  onBack,
  onSave,
}: {
  editing: Editing
  near: GeoPoint | null
  onBack: () => void
  onSave: (e: Editing) => void
}) {
  const [name, setName] = useState(editing.name)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [chosen, setChosen] = useState<PlaceHit | null>(editing.hit)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Gõ địa chỉ → gợi ý HERE (≥ 3 ký tự, chờ 400 ms); dán link Google Maps → đọc link.
  useEffect(() => {
    const text = q.trim()
    setMsg(null)
    if (text.length < 3) return setHits([])
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setBusy(true)
      try {
        if (firstUrl(text)) {
          const hit = await placeFromLink(text, near, ctrl.signal)
          if (ctrl.signal.aborted) return
          if (hit) {
            setChosen(hit)
            setHits([])
          } else setMsg(L.badLink)
        } else {
          const list = await searchAddress(text, near, ctrl.signal)
          if (ctrl.signal.aborted) return
          setHits(list)
          if (!list.length) setMsg(L.noHit)
        }
      } catch {
        if (!ctrl.signal.aborted) setMsg(L.noHit)
      } finally {
        if (!ctrl.signal.aborted) setBusy(false)
      }
    }, 400)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q, near])

  async function useHere() {
    setBusy(true)
    setMsg(null)
    const { pos, result } = await getPosition(true)
    if (!pos) {
      setBusy(false)
      return setMsg(result === 'denied' ? L.gpsDenied : L.gpsFailed)
    }
    const label = (await reverse(pos, new AbortController().signal).catch(() => null)) ?? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`
    setChosen({ label, address: '', lat: pos.lat, lng: pos.lng })
    setHits([])
    setBusy(false)
  }

  async function paste() {
    try {
      const t = (await navigator.clipboard.readText()).trim()
      if (t) setQ(t)
    } catch {
      // Trình duyệt chặn đọc clipboard — người dùng dán tay vào ô.
    }
  }

  const canSave = !!chosen && (editing.kind !== 'custom' || name.trim().length > 0)

  return (
    <div className="mt-2 flex flex-col gap-3">
      {editing.kind === 'custom' && (
        <Input value={name} onChange={(e) => setName(e.target.value.slice(0, PLACE_NAME_MAX))} placeholder={L.name} aria-label={L.name} />
      )}
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} aria-label={L.search} className="min-w-0" />
        <Button type="button" variant="outline" size="icon" aria-label={L.paste} title={L.paste} onClick={paste}>
          <ClipboardPaste />
        </Button>
        {/* Vị trí hiện tại: nút icon cạnh nút dán. */}
        <Button type="button" variant="outline" size="icon" aria-label={L.here} title={L.here} onClick={useHere} disabled={busy}>
          <LocateFixed className="text-brand" />
        </Button>
      </div>

      {busy && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> {L.locating}
        </p>
      )}
      {msg && <p className="text-xs text-warn">{msg}</p>}

      {hits.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-xl border border-border">
          {hits.map((h, i) => (
            <li key={`${h.lat},${h.lng},${i}`} className="border-b border-border/60 last:border-b-0">
              <button
                type="button"
                className="flex w-full flex-col px-3 py-2 text-left hover:bg-muted"
                onClick={() => {
                  setChosen(h)
                  setHits([])
                }}
              >
                <span className="text-sm">{h.label}</span>
                {h.address && <span className="truncate text-xs text-muted-foreground">{h.address}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen && (
        <Chosen>
          <span className="text-sm font-medium">{chosen.label}</span>
          {chosen.address && <span className="text-xs text-muted-foreground">{chosen.address}</span>}
        </Chosen>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ChevronLeft />
          {L.back}
        </Button>
        <Button type="button" variant="brand" className="flex-1" disabled={!canSave} onClick={() => onSave({ ...editing, name, hit: chosen })}>
          {L.save}
        </Button>
      </div>
    </div>
  )
}

function Chosen({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-brand/10 px-3 py-2">
      <MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] font-medium text-brand">{L.chosen}</span>
        {children}
      </span>
    </div>
  )
}
