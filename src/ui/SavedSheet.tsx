import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeftRight, NotebookPen, X } from 'lucide-react'
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
import type { NoteMap } from '../data/notes'
import { GroupGlyph, PinPreview } from './groupIcons'
import { tintHex } from '../map/pins'
import { fmtDistance } from '@/lib/format'
import { LOCALE, pick } from '../i18n'

const L = pick({
  vi: {
    title: 'Trạm sạc đã lưu',
    empty: 'Chưa có trạm nào. Mở một trạm rồi bấm “Lưu” để thêm vào nhóm.',
    filtered: (shown: number, total: number) => `${shown}/${total} trạm`,
    count: (n: number) => `${n} trạm đã lưu`,
    backup: 'Sao lưu / chuyển máy',
    all: 'Tất cả',
    left: (t: string) => `còn ${t}`,
    unsave: (name: string) => `Bỏ ${name} khỏi mọi nhóm`,
  },
  en: {
    title: 'Saved charging stations',
    empty: 'No stations yet. Open a station and tap “Save” to add it to a group.',
    filtered: (shown: number, total: number) => `${shown}/${total} ${total === 1 ? 'station' : 'stations'}`,
    count: (n: number) => `${n} saved ${n === 1 ? 'station' : 'stations'}`,
    backup: 'Back up / transfer',
    all: 'All',
    left: (t: string) => `${t} left`,
    unsave: (name: string) => `Remove ${name} from all groups`,
  },
})

interface Props {
  /** Giữ component gắn và chỉ đổi `open` — gỡ hẳn khi đóng thì mất hiệu ứng trôi xuống. */
  open: boolean
  index: StationIndex
  book: GroupBook
  /** Ghi chú cá nhân — trạm có ghi chú hiện một dòng thay cho địa chỉ. */
  notes: NoteMap
  now: number
  userPos: { lat: number; lng: number } | null
  onPick: (st: Station) => void
  onUnsave: (entityId: string) => void
  onBackup: () => void
  onClose: () => void
  /** Bảng con (sao lưu), render BÊN TRONG cây hộp thoại này để vaul xếp chồng đúng. */
  children?: ReactNode
}

const DEFAULT_PIN = { iconKey: 'charger', colorHex: '#12B76A' } as const

/** Danh sách mọi trạm đã lưu, lọc theo nhóm. Port FavoritesTab (PlacesSheet.kt). */
export function SavedSheet({ open, index, book, notes, now, userPos, onPick, onUnsave, onBackup, onClose, children }: Props) {
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
    rows.sort((a, b) => (userPos ? a.km - b.km : a.st.name.localeCompare(b.st.name, LOCALE)))
    return rows
  }, [index, book, userPos])

  // Chỉ hiện nhóm đang có trạm: nhóm rỗng làm hàng chip dài ra mà bấm vào chỉ được danh sách trống.
  const usedGroups = book.groups.filter((g) => idsIn(book, g.id).length > 0)
  // Nhóm đang lọc mà vừa rỗng (bỏ lưu, xoá nhóm, hết hạn) thì chip của nó biến mất — bỏ khỏi
  // bộ lọc luôn, không thì danh sách kẹt "0 trạm" mà không chip nào sáng.
  const active = new Set([...filter].filter((id) => usedGroups.some((g) => g.id === id)))

  const shown = active.size === 0
    ? items
    : items.filter(({ st }) => [...active].some((g) => idsIn(book, g).includes(st.entityId)))

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-lg">{L.title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-sm">
            {items.length === 0
              ? L.empty
              : active.size > 0
                ? L.filtered(shown.length, items.length)
                : L.count(items.length)}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {/* Luôn hiện, kể cả khi chưa lưu gì: máy mới cần chỗ "Nhập từ file". */}
        <Button variant="outline" size="sm" className="mt-2 self-start rounded-full" onClick={onBackup}>
          <ArrowLeftRight />
          {L.backup}
        </Button>

        {items.length > 0 && (
          <div className="mt-2 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
            <Chip selected={active.size === 0} onClick={() => setFilter(new Set())}>
              {L.all}
            </Chip>
            {usedGroups.map((g) => {
              const on = active.has(g.id)
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
                  <PinPreview group={pin ?? DEFAULT_PIN} width={32} className="shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 text-[15px] leading-snug">{st.name}</span>
                    {notes[st.entityId] ? (
                      <span className="flex items-center gap-1 text-xs text-[#B45309] dark:text-[#F0A500]">
                        <NotebookPen className="size-3 shrink-0" aria-hidden />
                        <span className="truncate">{notes[st.entityId].text}</span>
                      </span>
                    ) : (
                      <span className="truncate text-xs text-muted-foreground">{st.address}</span>
                    )}
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
                      <span className="text-[11px] text-muted-foreground">{L.left(remaining(exp, now))}</span>
                    )}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={L.unsave(st.name)}
                  onClick={() => onUnsave(st.entityId)}
                >
                  <X />
                </Button>
              </li>
            )
          })}
        </ul>
        {children}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
