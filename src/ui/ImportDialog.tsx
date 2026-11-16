import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import type { GroupBook } from '../data/groups'
import { diffCount } from '../data/backup'

/**
 * Một lần nhập đang chờ xác nhận. `incoming` null = link / file hỏng. `diff` chụp lúc mở: gộp
 * xong sổ nhóm đổi ngay, tính lại thì câu chữ nhảy thành "không có gì mới" lúc đang đóng.
 */
export interface PendingImport {
  incoming: GroupBook | null
  diff: { stations: number; groups: number } | null
}

export function pendingImport(book: GroupBook, incoming: GroupBook | null): PendingImport {
  return { incoming, diff: incoming ? diffCount(book, incoming) : null }
}

interface Props {
  open: boolean
  /** Giữ lần nhập cuối cả khi đã đóng — nội dung không đổi giữa lúc hộp thoại trôi xuống. */
  pending: PendingImport | null
  onConfirm: (incoming: GroupBook) => void
  onClose: () => void
}

/** Xác nhận trước khi gộp sổ nhóm từ link / file sao lưu — dữ liệu từ ngoài không tự ghi vào. */
export function ImportDialog({ open, pending, onConfirm, onClose }: Props) {
  const incoming = pending?.incoming ?? null
  const diff = pending?.diff ?? null
  const nothing = diff !== null && diff.stations === 0 && diff.groups === 0

  let title = 'Nhập trạm đã lưu'
  let text = ''
  if (!incoming) {
    title = 'Không đọc được bản sao lưu'
    text = 'Link hoặc file bị hỏng, bị cắt mất một phần, hoặc không phải bản sao lưu của Bản đồ trạm sạc.'
  } else if (nothing) {
    text = 'Không có gì mới để nhập — máy này đã có đủ các trạm trong bản sao lưu.'
  } else if (diff) {
    const parts = [`${diff.stations} trạm`, diff.groups ? `${diff.groups} nhóm mới` : ''].filter(Boolean)
    text = `Gộp ${parts.join(' và ')} vào máy này? Trạm đã lưu sẵn giữ nguyên.`
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-lg">{title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-sm">{text}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter className="mt-4 flex-row justify-end">
          {incoming && !nothing ? (
            <>
              <Button variant="outline" className="flex-1 sm:flex-none" onClick={onClose}>
                Huỷ
              </Button>
              <Button variant="brand" className="flex-1 sm:flex-none" onClick={() => onConfirm(incoming)}>
                Gộp vào
              </Button>
            </>
          ) : (
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={onClose}>
              Đóng
            </Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
