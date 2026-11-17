import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { DrawerContent, DrawerHeader, DrawerNestedRoot, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

export interface ResponsiveOption {
  value: string
  label: ReactNode
}

/**
 * Chọn một giá trị: mobile mở drawer từ dưới lên (lồng trên form/drawer đang mở), desktop dùng dropdown.
 * Lấy từ chiatien (src/components/responsive-select.tsx) — giữ hai bên giống nhau.
 */
export function ResponsiveSelect({
  id,
  value,
  onChange,
  options,
  title,
  disabled,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  options: ResponsiveOption[]
  /** Tiêu đề drawer. */
  title: string
  disabled?: boolean
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)

  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-label={title} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <DrawerNestedRoot open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          aria-label={title}
          disabled={disabled}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-transparent bg-muted px-3 text-sm transition-colors outline-none hover:bg-muted/80 focus-visible:ring-3 focus-visible:ring-brand/35 disabled:pointer-events-none disabled:opacity-50"
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">{current?.label}</span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85dvh] px-5">
        <DrawerHeader className="px-0 pb-2 text-left">
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="divide-y divide-border/60 overflow-y-auto py-2 pb-6">
          {options.map((o) => {
            const selected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between px-2 py-3.5 text-left text-sm transition-colors hover:bg-muted/50',
                  selected ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
              >
                <span className="flex items-center gap-2">{o.label}</span>
                {selected && <CheckIcon className="size-4 text-primary" />}
              </button>
            )
          })}
        </div>
      </DrawerContent>
    </DrawerNestedRoot>
  )
}
