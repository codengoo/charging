import * as React from 'react'
import { Switch as SwitchPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

/** Công tắc gạt (Radix Switch) — bật = nền brand, núm trắng trượt sang phải. */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-brand/35 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-brand data-[state=unchecked]:bg-muted-foreground/25',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-6 rounded-full bg-white shadow-md transition-transform duration-200 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

/**
 * Một hàng cài đặt bật / tắt: tên (+ mô tả) bên trái, công tắc bên phải; bấm cả hàng cũng gạt được
 * (nhãn `<label>` bọc công tắc).
 */
function SwitchRow({
  title,
  hint,
  checked,
  onCheckedChange,
}: {
  title: string
  hint?: string
  checked: boolean
  onCheckedChange: (on: boolean) => void
}) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col">
        <span className="text-sm font-semibold">{title}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export { Switch, SwitchRow }
