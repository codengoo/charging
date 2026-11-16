import { useLayoutEffect, useState } from 'react'
import { ArrowLeft, Check, Clock, Plus, Trash2 } from 'lucide-react'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  COLORS,
  ICON_KEYS,
  TTL_OPTIONS,
  expiresAt,
  groupsOf,
  idsIn,
  remaining,
  ttlLabel,
  type GroupBook,
  type GroupIconKey,
  type StationGroup,
} from '../data/groups'
import { PinPreview, groupIcon } from './groupIcons'
import { darkenHex, tintHex } from '../map/pins'
import { pick } from '../i18n'

const L = pick({
  vi: {
    title: 'Lưu vào nhóm',
    multi: 'Một trạm có thể nằm trong nhiều nhóm.',
    newGroup: 'Tạo nhóm mới',
    empty: 'Chưa có trạm nào',
    count: (n: number) => `${n} trạm`,
    left: (s: string) => ` · còn ${s}`,
    autoRemove: (s: string) => ` · tự gỡ sau ${s}`,
    inGroup: 'Đang ở trong nhóm',
    setTtl: (g: string) => `Đặt thời hạn tự gỡ cho nhóm ${g}`,
    deleteGroup: (g: string) => `Xoá nhóm ${g}`,
    confirmDelete: 'Xoá?',
    ttlFor: (g: string) => `Tự gỡ trạm khỏi “${g}” sau`,
    back: 'Quay lại',
    newTitle: 'Nhóm mới',
    newDesc: 'Đặt tên, chọn biểu tượng, màu và thời hạn tự gỡ cho nhóm.',
    name: 'Tên nhóm',
    icon: 'Biểu tượng',
    color: 'Màu',
    colorAria: (hex: string) => `Màu ${hex}`,
    ttl: 'Tự gỡ trạm khỏi nhóm sau',
    cancel: 'Huỷ',
    create: 'Tạo nhóm',
  },
  en: {
    title: 'Save to group',
    multi: 'A station can be in several groups.',
    newGroup: 'New group',
    empty: 'No stations yet',
    count: (n: number) => `${n} ${n === 1 ? 'station' : 'stations'}`,
    left: (s: string) => ` · ${s} left`,
    autoRemove: (s: string) => ` · auto-remove after ${s}`,
    inGroup: 'In this group',
    setTtl: (g: string) => `Set auto-remove time for group ${g}`,
    deleteGroup: (g: string) => `Delete group ${g}`,
    confirmDelete: 'Delete?',
    ttlFor: (g: string) => `Remove stations from “${g}” after`,
    back: 'Back',
    newTitle: 'New group',
    newDesc: 'Name the group and choose its icon, color and auto-remove time.',
    name: 'Group name',
    icon: 'Icon',
    color: 'Color',
    colorAria: (hex: string) => `Color ${hex}`,
    ttl: 'Remove stations from group after',
    cancel: 'Cancel',
    create: 'Create group',
  },
})

interface Props {
  /** Giữ component gắn và chỉ đổi `open` — gỡ hẳn khi đóng thì mất hiệu ứng trôi xuống. */
  open: boolean
  book: GroupBook
  now: number
  entityId: string
  stationName: string
  onToggle: (groupId: string) => void
  onCreate: (g: Omit<StationGroup, 'id' | 'builtIn'>) => void
  onDelete: (groupId: string) => void
  onTtlChange: (groupId: string, hours: number) => void
  onClose: () => void
}

/**
 * Bảng xếp một trạm vào các nhóm. Mở khi bấm "Lưu" ở bảng chi tiết trạm — một trạm nằm
 * được nhiều nhóm nên phải có chỗ chọn, không còn là công tắc hai trạng thái.
 *
 * Tạo nhóm mới đổi NỘI DUNG bảng này thay vì mở thêm một tầng hộp thoại thứ ba.
 */
export function GroupsSheet(props: Props) {
  const { open, book, now, entityId, stationName, onClose } = props
  const [creating, setCreating] = useState(false)
  // Mở lại thì về danh sách nhóm. Reset lúc MỞ (trước khi vẽ) chứ không lúc đóng — đổi nội
  // dung giữa hiệu ứng trôi xuống trông như giật.
  useLayoutEffect(() => {
    if (open) setCreating(false)
  }, [open])
  const inGroups = new Set(groupsOf(book, entityId))

  return (
    <ResponsiveDialog nested open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        {creating ? (
          <NewGroupForm
            onCancel={() => setCreating(false)}
            onSave={(g) => {
              props.onCreate(g)
              setCreating(false)
            }}
          />
        ) : (
          <>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle className="text-lg">{L.title}</ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="text-sm">
                <span className="line-clamp-1">{stationName}</span>
                {L.multi}
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <div className="mt-2 flex flex-col">
              {book.groups.map((g) => (
                <GroupRow
                  key={g.id}
                  group={g}
                  checked={inGroups.has(g.id)}
                  count={idsIn(book, g.id).length}
                  expiresAt={expiresAt(book, g.id, entityId)}
                  now={now}
                  onClick={() => props.onToggle(g.id)}
                  onDelete={g.builtIn ? undefined : () => props.onDelete(g.id)}
                  onTtlChange={(h) => props.onTtlChange(g.id, h)}
                />
              ))}
            </div>

            <Button variant="ghost" className="mt-2 self-start text-brand" onClick={() => setCreating(true)}>
              <Plus />
              {L.newGroup}
            </Button>
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

function GroupRow({
  group,
  checked,
  count,
  expiresAt,
  now,
  onClick,
  onDelete,
  onTtlChange,
}: {
  group: StationGroup
  checked: boolean
  count: number
  /** Lúc trạm ĐANG XẾP rời nhóm này; null = không tự gỡ. */
  expiresAt: number | null
  now: number
  onClick: () => void
  onDelete?: () => void
  onTtlChange: (hours: number) => void
}) {
  const [pickTtl, setPickTtl] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Trạm đang trong nhóm và có hạn thì nói còn bao lâu; không thì nói luật chung của nhóm.
  let sub = count === 0 ? L.empty : L.count(count)
  if (expiresAt !== null) sub += L.left(remaining(expiresAt, now))
  else if (group.ttlHours > 0) sub += L.autoRemove(ttlLabel(group.ttlHours))

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onClick}
          aria-pressed={checked}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 py-2.5 text-left transition-colors hover:bg-muted/60"
        >
          {/* Ghim y như trên bản đồ: nhìn là biết trạm sẽ hiện ra thế nào. */}
          <PinPreview group={group} width={28} className={cn('shrink-0 transition-opacity', !checked && 'opacity-70')} />
          <span className="flex min-w-0 flex-col">
            <span className={cn('truncate text-[15px]', checked && 'font-semibold')}>{group.label}</span>
            <span className="truncate text-xs text-muted-foreground">{sub}</span>
          </span>
          {checked && (
            <Check className="ml-auto size-5 shrink-0" color={darkenHex(group.colorHex, 0.8)} aria-label={L.inGroup} />
          )}
        </button>

        {/* Chỉ nhóm tự tạo mới đặt được thời hạn; ba nhóm dựng sẵn giữ vĩnh viễn. */}
        {!group.builtIn && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={L.setTtl(group.label)}
            aria-expanded={pickTtl}
            onClick={() => setPickTtl((v) => !v)}
          >
            <Clock color={group.ttlHours > 0 ? darkenHex(group.colorHex, 0.8) : undefined} />
          </Button>
        )}
        {onDelete && (
          <Button
            variant={confirmDelete ? 'destructive' : 'ghost'}
            size={confirmDelete ? 'sm' : 'icon-sm'}
            aria-label={L.deleteGroup(group.label)}
            onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            onBlur={() => setConfirmDelete(false)}
          >
            <Trash2 />
            {confirmDelete && L.confirmDelete}
          </Button>
        )}
      </div>

      {pickTtl && (
        <div className="pb-3 pl-11">
          <p className="mb-1.5 text-xs text-muted-foreground">{L.ttlFor(group.label)}</p>
          <TtlChips
            selected={group.ttlHours}
            onSelect={(h) => {
              onTtlChange(h)
              setPickTtl(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

function TtlChips({ selected, onSelect }: { selected: number; onSelect: (hours: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TTL_OPTIONS.map((t) => (
        <Chip key={t.hours} size="sm" selected={t.hours === selected} onClick={() => onSelect(t.hours)}>
          {t.label}
        </Chip>
      ))}
    </div>
  )
}

/**
 * Form tạo nhóm: tên, biểu tượng, màu, thời hạn. Ghim xem trước đổi ngay theo lựa chọn —
 * chọn màu và hình rồi phải tưởng tượng ra kết quả thì hay chọn trượt.
 */
function NewGroupForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void
  onSave: (g: Omit<StationGroup, 'id' | 'builtIn'>) => void
}) {
  const [label, setLabel] = useState('')
  const [iconKey, setIconKey] = useState<GroupIconKey>(ICON_KEYS[0])
  const [colorHex, setColorHex] = useState(COLORS[0])
  const [ttlHours, setTtlHours] = useState(0)
  const valid = label.trim().length > 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave({ label: label.trim(), iconKey, colorHex, ttlHours })
      }}
    >
      <ResponsiveDialogHeader>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" aria-label={L.back} onClick={onCancel}>
            <ArrowLeft />
          </Button>
          <ResponsiveDialogTitle className="text-lg">{L.newTitle}</ResponsiveDialogTitle>
        </div>
        <ResponsiveDialogDescription className="sr-only">
          {L.newDesc}
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <div className="mt-3 flex items-end gap-3">
        <PinPreview group={{ iconKey, colorHex }} width={40} className="shrink-0" />
        <Input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={L.name}
          maxLength={40}
          aria-label={L.name}
        />
      </div>

      <p className="mt-4 mb-1.5 text-xs font-medium">{L.icon}</p>
      <div className="flex flex-wrap gap-2">
        {ICON_KEYS.map((key) => {
          const Icon = groupIcon(key)
          const on = key === iconKey
          return (
            <button
              key={key}
              type="button"
              aria-label={key}
              aria-pressed={on}
              onClick={() => setIconKey(key)}
              className="flex size-10 items-center justify-center rounded-full bg-muted transition-colors"
              style={on ? { background: tintHex(colorHex, 0.3) } : undefined}
            >
              <Icon className="size-5" color={on ? darkenHex(colorHex) : 'var(--muted-foreground)'} />
            </button>
          )
        })}
      </div>

      <p className="mt-4 mb-1.5 text-xs font-medium">{L.color}</p>
      <div className="flex flex-wrap gap-2">
        {COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={L.colorAria(hex)}
            aria-pressed={hex === colorHex}
            onClick={() => setColorHex(hex)}
            className="size-8 rounded-full transition-transform active:scale-95"
            // Viền lấy chính màu đó đậm lên — vòng đen quanh chấm pastel mang vào bảng một màu lạ.
            style={{
              background: hex,
              boxShadow: hex === colorHex ? `inset 0 0 0 3px ${darkenHex(hex)}` : undefined,
            }}
          />
        ))}
      </div>

      <p className="mt-4 mb-1.5 text-xs font-medium">{L.ttl}</p>
      <TtlChips selected={ttlHours} onSelect={setTtlHours} />

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {L.cancel}
        </Button>
        <Button type="submit" variant="brand" disabled={!valid}>
          {L.create}
        </Button>
      </div>
    </form>
  )
}
