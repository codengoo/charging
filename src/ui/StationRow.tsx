import type { ReactNode } from 'react'

interface Props {
  /** Ghim / chấm màu đầu hàng. */
  leading: ReactNode
  title: string
  /** Dòng phụ dưới tên (địa chỉ, ghi chú…). Chuỗi thì cắt một dòng màu nhạt. */
  subtitle: ReactNode
  /** Cột phải (khoảng cách, kW, nhóm…). */
  trailing?: ReactNode
  onClick: () => void
  /** Nút phụ ngoài vùng bấm chính (vd. bỏ lưu). */
  after?: ReactNode
}

/** Một hàng trạm trong danh sách (Gần bạn, Đã lưu): bấm cả hàng để mở trạm. */
export function StationRow({ leading, title, subtitle, trailing, onClick, after }: Props) {
  return (
    <li className="flex items-center gap-2 border-b border-border/60 last:border-b-0">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left" onClick={onClick}>
        {leading}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 text-[15px] leading-snug">{title}</span>
          {typeof subtitle === 'string' ? <span className="truncate text-xs text-muted-foreground">{subtitle}</span> : subtitle}
        </span>
        {trailing && <span className="flex shrink-0 flex-col items-end gap-0.5">{trailing}</span>}
      </button>
      {after}
    </li>
  )
}
