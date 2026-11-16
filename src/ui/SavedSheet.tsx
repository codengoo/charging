import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import {
  allSaved,
  group,
  groupsOf,
  idsIn,
  pinGroupOf,
  remaining,
  soonestExpiry,
  type GroupBook,
} from '../data/groups'
import { distanceKm, type StationIndex } from '../data/stations'
import type { Station } from '../data/types'
import { GroupGlyph, PinPreview } from './groupIcons'
import { tintHex } from '../map/pins'

interface Props {
  /** Giữ component gắn và chỉ đổi `open` — gỡ hẳn khi đóng thì mất hiệu ứng trôi xuống. */
  open: boolean
  index: StationIndex
  book: GroupBook
  now: number
  userPos: { lat: number; lng: number } | null
  onPick: (st: Station) => void
  onUnsave: (entityId: string) => void
  onClose: () => void
}

const DEFAULT_PIN = { iconKey: 'charger', colorHex: '#12B76A' } as const

/** Danh sách mọi trạm đã lưu, lọc theo nhóm. Port FavoritesTab (PlacesSheet.kt). */
export function SavedSheet({ open, index, book, now, userPos, onPick, onUnsave, onClose }: Props) {
  // Rỗng = xem tất cả. Chọn NHIỀU nhóm là phép HOẶC: chọn "Sao" và "Sẽ đến" là muốn
  // thấy cả hai, không phải trạm nằm trong cả hai.
  const [filter, setFilter] = useState<Set<string>>(new Set())

  const items = useMemo(() => {
    const rows = [...allSaved(book)]
      .map((id) => index.byId.get(id))
      .filter((s): s is Station => !!s)
      .map((st) => ({
        st,
        km: userPos ? distanceKm(userPos.lat, userPos.lng, st.lat, st.lng) : NaN,
      }))
    // Có vị trí thì gần nhất lên trước; không có thì theo tên.
    rows.sort((a, b) => (userPos ? a.km - b.km : a.st.name.localeCompare(b.st.name, 'vi')))
    return rows
  }, [index, book, userPos])

  const shown = filter.size === 0
    ? items
    : items.filter(({ st }) => [...filter].some((g) => idsIn(book, g).includes(st.entityId)))

  // Chỉ hiện nhóm đang có trạm: nhóm rỗng làm hàng chip dài ra mà bấm vào chỉ được danh sách trống.
  const usedGroups = book.groups.filter((g) => idsIn(book, g.id).length > 0)

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-lg">Trạm sạc đã lưu</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-sm">
            {items.length === 0
              ? 'Chưa có trạm nào. Mở một trạm rồi bấm “Lưu” để thêm vào nhóm.'
              : filter.size > 0
                ? `${shown.length}/${items.length} trạm`
                : `${items.length} trạm đã lưu`}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {items.length > 0 && (
          <div className="mt-2 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
            <Chip selected={filter.size === 0} onClick={() => setFilter(new Set())}>
              Tất cả
            </Chip>
            {usedGroups.map((g) => {
              const on = filter.has(g.id)
              return (
                // Chip nhóm bật thì lấy màu của nhóm (viền + nền nhạt) thay vì brand chung.
                <Chip
                  key={g.id}
                  variant={on ? 'outline' : 'secondary'}
                  aria-pressed={on}
                  style={on ? { borderColor: g.colorHex, background: tintHex(g.colorHex, 0.18) } : undefined}
                  onClick={() =>
                    setFilter((prev) => {
                      const next = new Set(prev)
                      if (next.has(g.id)) next.delete(g.id)
                      else next.add(g.id)
                      return next
                    })
                  }
                >
                  <GroupGlyph group={g} />
                  {g.label}
                </Chip>
              )
            })}
          </div>
        )}

        <ul className="mt-2 flex flex-col">
          {shown.map(({ st, km }) => {
            const gids = groupsOf(book, st.entityId)
            const pin = group(book, pinGroupOf(book, st.entityId) ?? '')
            const exp = soonestExpiry(book, st.entityId)
            return (
              <li key={st.entityId} className="flex items-center gap-2 border-b border-border/60 last:border-b-0">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
                  onClick={() => onPick(st)}
                >
                  <PinPreview group={pin ?? DEFAULT_PIN} width={24} className="shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 text-[15px] leading-snug">{st.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{st.address}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    {!Number.isNaN(km) && <span className="text-sm font-semibold">{fmtDistance(km)}</span>}
                    <span className="flex gap-0.5">
                      {gids.slice(0, 3).map((gid) => {
                        const g = group(book, gid)
                        return g ? <GroupGlyph key={gid} group={g} className="size-3.5" /> : null
                      })}
                    </span>
                    {exp !== null && (
                      <span className="text-[11px] text-muted-foreground">còn {remaining(exp, now)}</span>
                    )}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Bỏ ${st.name} khỏi mọi nhóm`}
                  onClick={() => onUnsave(st.entityId)}
                >
                  <X />
                </Button>
              </li>
            )
          })}
        </ul>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

function fmtDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}
