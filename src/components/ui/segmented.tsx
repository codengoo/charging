import type { LucideIcon } from "lucide-react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"
import { cn } from "cn"

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
}

/**
 * Chọn một trong vài lựa chọn, kiểu iOS segmented control — cùng bộ với chiatien
 * (`src/components/segmented.tsx`). Dùng cho chuyển chế độ trong một hộp thoại; bộ lọc bật/tắt
 * độc lập thì dùng Chip.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: SegmentedOption<T>[]
  label: string
  className?: string
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      // Bấm lại lựa chọn đang chọn trả về '' — bỏ qua để luôn có một lựa chọn.
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("flex w-full gap-1 rounded-xl bg-muted p-1", className)}
    >
      {options.map(({ value: v, label: text, icon: Icon }) => (
        <ToggleGroupPrimitive.Item
          key={v}
          value={v}
          // Đang chọn: nền trắng nổi trên rãnh xám; chế độ tối dùng xám sáng hơn rãnh.
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground outline-none transition-[color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-brand/60 data-[state=on]:bg-white data-[state=on]:text-foreground data-[state=on]:shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:data-[state=on]:bg-white/15 dark:data-[state=on]:shadow-none [&_svg]:size-4"
        >
          {Icon && <Icon />}
          {text}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}
