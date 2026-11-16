import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * Chip dùng chung cho toàn app — nhãn tĩnh (công cộng, trụ LINK, nhóm đã lưu) lẫn chip bấm
 * được (bộ lọc, thời hạn). Một nguồn kích thước duy nhất để các chip cao bằng nhau.
 *
 * Có `onClick` thì render <button> (kèm `aria-pressed` khi truyền `selected`), không thì <span>.
 * `selected` đè `variant` thành brand — chip lọc chỉ cần đổi một prop.
 */
const chipVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent font-medium whitespace-nowrap transition-[color,background-color,border-color,transform] outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border-border bg-card text-foreground",
        brand: "bg-brand text-brand-foreground",
        /** Nổi trên bản đồ: nền kính mờ + bóng, để chip đọc được trên mọi màu nền. */
        floating: "bg-card/90 text-foreground shadow-md shadow-black/10 backdrop-blur",
      },
      size: {
        sm: "h-7 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-8 px-3.5 text-[13px] [&_svg:not([class*='size-'])]:size-4",
      },
      interactive: {
        true: "cursor-pointer active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        false: "",
      },
    },
    compoundVariants: [
      { interactive: true, variant: "secondary", className: "hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)]" },
      { interactive: true, variant: "outline", className: "hover:bg-muted" },
      { interactive: true, variant: "floating", className: "hover:bg-card" },
      { interactive: true, variant: "brand", className: "hover:bg-brand/85" },
    ],
    defaultVariants: {
      variant: "secondary",
      size: "md",
      interactive: false,
    },
  }
)

type ChipProps = Omit<React.ComponentProps<"button">, "type"> &
  Omit<VariantProps<typeof chipVariants>, "interactive"> & {
    /** Trạng thái bật của chip lọc: đổi sang brand + aria-pressed. */
    selected?: boolean
  }

function Chip({ className, variant, size, selected, onClick, ...props }: ChipProps) {
  const v = selected ? "brand" : variant
  const interactive = !!onClick
  const classes = cn(chipVariants({ variant: v, size, interactive }), className)

  if (interactive) {
    return (
      <button
        type="button"
        data-slot="chip"
        data-variant={v}
        aria-pressed={selected}
        className={classes}
        onClick={onClick}
        {...props}
      />
    )
  }
  return (
    <span
      data-slot="chip"
      data-variant={v}
      className={classes}
      {...(props as React.ComponentProps<"span">)}
    />
  )
}

export { Chip, chipVariants }
