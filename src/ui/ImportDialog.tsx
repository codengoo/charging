import {
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import type { GroupBook } from '../data/groups'
import type { NoteMap } from '../data/notes'
import { diffCount, type Backup } from '../data/backup'
import { pick } from '../i18n'
import { AppSheet } from './AppSheet'

const L = pick({
  vi: {
    title: 'Nhập trạm đã lưu',
    badTitle: 'Không đọc được bản sao lưu',
    badText: 'Link hoặc file bị hỏng, bị cắt mất một phần, hoặc không phải bản sao lưu của Bản đồ trạm sạc.',
    nothing: 'Không có gì mới để nhập — máy này đã có đủ các trạm trong bản sao lưu.',
    merge: (stations: number, groups: number, notes: number) => {
      const parts = [stations ? `${stations} trạm` : '', groups ? `${groups} nhóm mới` : '', notes ? `${notes} ghi chú` : ''].filter(Boolean)
      return `Gộp ${parts.join(' và ')} vào máy này? Trạm đã lưu sẵn giữ nguyên.`
    },
    cancel: 'Huỷ',
    confirm: 'Gộp vào',
    close: 'Đóng',
  },
  en: {
    title: 'Import saved stations',
    badTitle: "Couldn't read the backup",
    badText: 'The link or file is damaged, cut off, or not a VinFast Charging Map backup.',
    nothing: 'Nothing new to import — this device already has all the stations in the backup.',
    merge: (stations: number, groups: number, notes: number) => {
      const parts = [
        stations ? `${stations} ${stations === 1 ? 'station' : 'stations'}` : '',
        groups ? `${groups} new ${groups === 1 ? 'group' : 'groups'}` : '',
        notes ? `${notes} ${notes === 1 ? 'note' : 'notes'}` : '',
      ].filter(Boolean)
      return `Merge ${parts.join(' and ')} into this device? Stations already saved are kept.`
    },
    cancel: 'Cancel',
    confirm: 'Merge',
    close: 'Close',
  },
})

/**
 * Một lần nhập đang chờ xác nhận. `incoming` null = link / file hỏng. `diff` chụp lúc mở: gộp
 * xong sổ nhóm đổi ngay, tính lại thì câu chữ nhảy thành "không có gì mới" lúc đang đóng.
 */
export interface PendingImport {
  incoming: Backup | null
  diff: { stations: number; groups: number; notes: number } | null
}

export function pendingImport(book: GroupBook, notes: NoteMap, incoming: Backup | null): PendingImport {
  return { incoming, diff: incoming ? diffCount(book, notes, incoming) : null }
}

interface Props {
  open: boolean
  /** Giữ lần nhập cuối cả khi đã đóng — nội dung không đổi giữa lúc hộp thoại trôi xuống. */
  pending: PendingImport | null
  onConfirm: (incoming: Backup) => void
  onClose: () => void
}

/** Xác nhận trước khi gộp sổ nhóm từ link / file sao lưu — dữ liệu từ ngoài không tự ghi vào. */
export function ImportDialog({ open, pending, onConfirm, onClose }: Props) {
  const incoming = pending?.incoming ?? null
  const diff = pending?.diff ?? null
  const nothing = diff !== null && diff.stations === 0 && diff.groups === 0 && diff.notes === 0

  let title = L.title
  let text = ''
  if (!incoming) {
    title = L.badTitle
    text = L.badText
  } else if (nothing) {
    text = L.nothing
  } else if (diff) {
    text = L.merge(diff.stations, diff.groups, diff.notes)
  }

  return (
    <AppSheet
      open={open}
      onClose={onClose}
      className="sm:max-w-sm"
      title={title}
      description={text}
    >
      <ResponsiveDialogFooter className="mt-4 flex-row justify-end">
        {incoming && !nothing ? (
          <>
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={onClose}>
              {L.cancel}
            </Button>
            <Button variant="brand" className="flex-1 sm:flex-none" onClick={() => onConfirm(incoming)}>
              {L.confirm}
            </Button>
          </>
        ) : (
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={onClose}>
            {L.close}
          </Button>
        )}
      </ResponsiveDialogFooter>
    </AppSheet>
  )
}
