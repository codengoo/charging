import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  images: string[]
  /** Ảnh đang xem; null = đóng. */
  index: number | null
  title: string
  onClose: () => void
}

/**
 * Xem ảnh trạm ngay trong app (giống modal ảnh của chiatien). KHÔNG mở link ảnh gốc: S3 của
 * VinFast trả `application/octet-stream`, trình duyệt sẽ tải file về thay vì hiện.
 *
 * Dải ảnh cuộn ngang có snap — vuốt trên điện thoại, mũi tên / phím ←→ trên máy tính.
 */
export function ImagePreview({ images, index, title, onClose }: Props) {
  const strip = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)

  // Mở ở đúng ảnh vừa bấm. Đợi một khung hình để dải ảnh có kích thước rồi mới cuộn.
  useEffect(() => {
    if (index === null) return
    setCurrent(index)
    const id = requestAnimationFrame(() => {
      const el = strip.current
      if (el) el.scrollTo({ left: index * el.clientWidth, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(id)
  }, [index])

  function go(i: number) {
    const el = strip.current
    if (!el) return
    const next = Math.max(0, Math.min(images.length - 1, i))
    // scrollIntoView thay vì scrollTo({behavior:'smooth'}): Chromium bỏ qua cuộn mượt bằng
    // scrollTo trên dải có snap-mandatory (đứng yên ở ảnh cũ).
    el.children[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }

  const many = images.length > 1

  return (
    <Dialog open={index !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="gap-3 p-4 sm:max-w-2xl"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(current - 1)
          if (e.key === 'ArrowRight') go(current + 1)
        }}
      >
        <DialogTitle className="pr-8 text-base font-semibold">{title}</DialogTitle>
        <DialogDescription className="sr-only">Ảnh trạm sạc</DialogDescription>

        <div className="relative overflow-hidden rounded-xl bg-black/5 dark:bg-white/5">
          <div
            ref={strip}
            className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
            onScroll={(e) => {
              const el = e.currentTarget
              setCurrent(Math.round(el.scrollLeft / el.clientWidth))
            }}
          >
            {images.map((url, i) => (
              <div key={url} className="grid w-full shrink-0 snap-center place-items-center p-1">
                <img
                  src={url}
                  alt={`Ảnh ${i + 1} / ${images.length}`}
                  decoding="async"
                  className="max-h-[70dvh] w-full rounded-lg object-contain"
                />
              </div>
            ))}
          </div>

          {many && (
            <>
              <Button
                variant="secondary"
                size="icon-sm"
                className="absolute top-1/2 left-2 hidden -translate-y-1/2 rounded-full bg-card/85 shadow-md backdrop-blur sm:inline-flex"
                disabled={current === 0}
                onClick={() => go(current - 1)}
                aria-label="Ảnh trước"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="secondary"
                size="icon-sm"
                className="absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-full bg-card/85 shadow-md backdrop-blur sm:inline-flex"
                disabled={current === images.length - 1}
                onClick={() => go(current + 1)}
                aria-label="Ảnh sau"
              >
                <ChevronRight />
              </Button>
            </>
          )}
        </div>

        {many && (
          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            {current + 1} / {images.length}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
