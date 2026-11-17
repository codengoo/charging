import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"
import { cn } from "cn"

/**
 * Thanh trượt shadcn (Radix Slider) theo token của app: rãnh trung tính, phần đã chọn màu brand,
 * núm tròn nền thẻ viền brand. Rãnh dùng foreground/10 thay vì bg-muted để vẫn thấy được khi
 * nằm trên hộp bg-muted.
 */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabel,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  /** Tên đọc cho trình đọc màn hình — Radix đặt role=slider trên núm, không phải trên Root. */
  thumbLabel?: string
}) {
  const values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]),
    [value, defaultValue, min],
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-foreground/10"
      >
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-brand" />
      </SliderPrimitive.Track>
      {values.map((_, i) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={i}
          aria-label={thumbLabel}
          className="block size-5 shrink-0 cursor-grab rounded-full border-2 border-brand bg-card shadow-[0_1px_3px_rgb(0_0_0/0.18)] transition-[box-shadow] outline-none hover:ring-4 hover:ring-brand/20 focus-visible:ring-4 focus-visible:ring-brand/30 active:cursor-grabbing disabled:pointer-events-none"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
