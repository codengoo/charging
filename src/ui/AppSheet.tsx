import type { ReactNode } from 'react'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'

interface Props {
  open: boolean
  onClose: () => void
  /** Mở chồng lên một bảng khác (vaul xếp chồng). */
  nested?: boolean
  title: ReactNode
  description?: ReactNode
  /** Lớp của khung, thường là bề rộng desktop (mặc định `sm:max-w-md`). */
  className?: string
  /** false = không tự focus ô đầu tiên khi mở (tránh bật bàn phím điện thoại). */
  autoFocus?: boolean
  /** false = drawer điện thoại không dùng hai mốc snap (bảng nhiều ô nhập — xem ResponsiveDialog). */
  snap?: boolean
  children?: ReactNode
}

/**
 * Bảng chuẩn của app: hộp thoại giữa màn trên desktop, ngăn kéo từ dưới trên điện thoại, MỘT kiểu
 * tiêu đề + mô tả. `pr-6` chừa chỗ nút đóng góc phải.
 */
export function AppSheet({ open, onClose, nested, title, description, className = 'sm:max-w-md', autoFocus = true, snap, children }: Props) {
  return (
    <ResponsiveDialog nested={nested} snap={snap} open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className={className} onOpenAutoFocus={autoFocus ? undefined : (e) => e.preventDefault()}>
        <ResponsiveDialogHeader className="gap-1 pr-6 text-left">
          <ResponsiveDialogTitle className="text-lg">{title}</ResponsiveDialogTitle>
          {description !== undefined && <ResponsiveDialogDescription className="text-sm">{description}</ResponsiveDialogDescription>}
        </ResponsiveDialogHeader>
        {children}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
