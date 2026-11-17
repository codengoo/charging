import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ClipboardPaste, Loader2, LocateFixed, MapPin, Pointer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PLACE_NAME_MAX, placeName, type PlaceKind } from '../data/places'
import { placeFromLink, reverse, searchAddress, type PlaceHit } from '../data/trip'
import { firstUrl } from '../lib/mapsLink'
import { getPosition, type GeoPoint } from '../lib/geo'
import { pick } from '../i18n'

const L = pick({
  vi: {
    editTitle: (n: string) => `Đặt ${n}`,
    newTitle: 'Địa điểm mới',
    tapMap: 'Chạm vào bản đồ để chọn chỗ, hoặc gõ địa chỉ / dán link.',
    back: 'Quay lại',
    name: 'Tên (vd. Quê, Nhà ngoại)',
    search: 'Gõ địa chỉ hoặc dán link Google Maps',
    paste: 'Dán từ bộ nhớ tạm',
    here: 'Dùng vị trí hiện tại',
    locating: 'Đang tìm…',
    gpsDenied: 'Trình duyệt đang chặn vị trí — bật lại quyền Vị trí cho trang này.',
    gpsFailed: 'Chưa lấy được vị trí, thử lại.',
    noHit: 'Không tìm thấy — thử gõ cụ thể hơn.',
    badLink: 'Không đọc được link này.',
    chosen: 'Đã chọn',
    save: 'Lưu',
  },
  en: {
    editTitle: (n: string) => `Set ${n}`,
    newTitle: 'New place',
    tapMap: 'Tap the map to pick a spot, or type an address / paste a link.',
    back: 'Back',
    name: 'Name (e.g. Hometown, Grandma)',
    search: 'Type an address or paste a Google Maps link',
    paste: 'Paste from clipboard',
    here: 'Use my current location',
    locating: 'Searching…',
    gpsDenied: 'Location is blocked — allow Location for this site.',
    gpsFailed: "Couldn't get your location, try again.",
    noHit: 'Nothing found — try a more specific address.',
    badLink: "Couldn't read this link.",
    chosen: 'Selected',
    save: 'Save',
  },
})

/** Địa điểm đang đặt: id ('home' / 'work' / id tự đặt), loại, tên, điểm đã chọn (nếu có). */
export interface PlaceEditTarget {
  id: string
  kind: PlaceKind
  name: string
  hit: PlaceHit | null
  /** Địa điểm mới (chưa có trong danh sách) — tiêu đề "Địa điểm mới". */
  isNew: boolean
}

interface Props {
  target: PlaceEditTarget
  near: GeoPoint | null
  /** Điểm vừa chạm trên bản đồ (App đọc click bản đồ khi đang đặt). */
  mapPick: PlaceHit | null
  /** Báo điểm đang chọn (App cắm ghim; `fly` = bay bản đồ tới — chọn từ ô tìm / GPS, không phải chạm bản đồ). */
  onChosen: (hit: PlaceHit | null, fly: boolean) => void
  onSave: (t: PlaceEditTarget) => void
  onCancel: () => void
}

/**
 * Màn đặt địa điểm: bảng nổi ở đáy, KHÔNG chặn bản đồ — chạm bản đồ để chọn chỗ (App tạm ẩn các bảng
 * đang xếp chồng). Cũng chọn được bằng gõ địa chỉ (gợi ý HERE), dán link Google Maps, vị trí hiện tại.
 */
export function PlaceEditorPanel({ target, near, mapPick, onChosen, onSave, onCancel }: Props) {
  const [name, setName] = useState(target.name)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [chosen, setChosen] = useState<PlaceHit | null>(target.hit)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const choose = (hit: PlaceHit | null, fly: boolean) => {
    setChosen(hit)
    setHits([])
    onChosen(hit, fly)
  }

  // Điểm có sẵn (sửa địa điểm cũ / chạm giữ bản đồ) → cắm ghim + bay tới ngay khi mở.
  useEffect(() => {
    onChosen(target.hit, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ lúc mở
  }, [])

  // Chạm bản đồ.
  useEffect(() => {
    if (mapPick) {
      setChosen(mapPick)
      setHits([])
      setMsg(null)
    }
  }, [mapPick])

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
          if (hit) choose(hit, true)
          else setMsg(L.badLink)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- choose ổn định theo lần render, chỉ chạy khi gõ
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
    choose({ label, address: '', lat: pos.lat, lng: pos.lng }, true)
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

  const canSave = !!chosen && (target.kind !== 'custom' || name.trim().length > 0)
  const title = target.isNew && target.kind === 'custom' ? L.newTitle : L.editTitle(target.kind === 'custom' ? name || L.newTitle : placeName(target))

  return (
    <section
      aria-label={title}
      className="absolute inset-x-0 bottom-0 z-[7] flex max-h-[70dvh] flex-col gap-3 overflow-y-auto rounded-t-[1.75rem] bg-popover px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom-8 fade-in-0 duration-300 sm:inset-x-auto sm:bottom-14 sm:left-3 sm:w-[400px] sm:rounded-2xl sm:pb-5 sm:shadow-xl"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Pointer className="size-4 shrink-0 text-brand" aria-hidden />
          {L.tapMap}
        </p>
      </header>

      {target.kind === 'custom' && (
        <Input value={name} onChange={(e) => setName(e.target.value.slice(0, PLACE_NAME_MAX))} placeholder={L.name} aria-label={L.name} />
      )}
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} aria-label={L.search} className="min-w-0" />
        <Button type="button" variant="outline" size="icon" aria-label={L.paste} title={L.paste} onClick={paste}>
          <ClipboardPaste />
        </Button>
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
              <button type="button" className="flex w-full flex-col px-3 py-2 text-left hover:bg-muted" onClick={() => choose(h, true)}>
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
        <Button type="button" variant="ghost" onClick={onCancel}>
          <ChevronLeft />
          {L.back}
        </Button>
        <Button type="button" variant="brand" className="flex-1" disabled={!canSave} onClick={() => onSave({ ...target, name, hit: chosen })}>
          {L.save}
        </Button>
      </div>
    </section>
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
