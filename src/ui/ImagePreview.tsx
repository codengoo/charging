import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import Lightbox from 'yet-another-react-lightbox'
import Inline from 'yet-another-react-lightbox/plugins/inline'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-media-query'
import { pick } from '@/i18n'

const L = pick({
  vi: {
    zoomHint: 'Ảnh trạm sạc. Chụm hai ngón hoặc chạm đúp để phóng to, kéo để di chuyển.',
    photos: 'Ảnh trạm sạc',
    prev: 'Ảnh trước',
    next: 'Ảnh sau',
    zoomIn: 'Phóng to',
    zoomOut: 'Thu nhỏ',
    close: 'Đóng',
    alt: (i: number, n: number) => `Ảnh ${i} / ${n}`,
  },
  en: {
    zoomHint: 'Charging station photos. Pinch or double-tap to zoom, drag to pan.',
    photos: 'Charging station photos',
    prev: 'Previous photo',
    next: 'Next photo',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    close: 'Close',
    alt: (i: number, n: number) => `Photo ${i} of ${n}`,
  },
})

interface Props {
  images: string[]
  /** Ảnh đang xem; null = đóng. */
  index: number | null
  title: string
  onClose: () => void
}

/**
 * Xem ảnh trạm ngay trong app. KHÔNG mở link ảnh gốc: S3 của VinFast trả
 * `application/octet-stream`, trình duyệt sẽ tải file về thay vì hiện.
 *
 * - Điện thoại (< 640px, cùng mốc với ResponsiveDialog): toàn màn hình, chụm / chạm đúp để
 *   zoom, kéo để di chuyển — trên máy nhỏ người ta mở ảnh ra là để phóng to.
 * - Máy tính: modal như cũ, màn đủ rộng để xem ảnh mà không cần zoom.
 */
export function ImagePreview(props: Props) {
  return useIsMobile() ? <ZoomViewer {...props} /> : <ModalViewer {...props} />
}

/** Màn cảm ứng: ẩn mũi tên + nút zoom — vuốt / chụm / chạm đúp là đủ, nút chỉ che ảnh. */
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/**
 * Bản điện thoại: toàn màn hình, zoom + kéo được (ảnh trạm hay phải phóng to để đọc biển,
 * nhìn trụ).
 *
 * Cử chỉ do yet-another-react-lightbox lo — tự viết thì chụm / kéo / vuốt-sang-ảnh dễ giành
 * nhau: chụm hai ngón hoặc chạm đúp để zoom, kéo khi đang zoom, vuốt ngang (lúc chưa zoom)
 * sang ảnh khác.
 *
 * Bọc trong Dialog của Radix (không dùng portal riêng của thư viện): bảng trạm là dialog
 * modal — portal ngoài cây Radix sẽ bị khoá pointer-events và bấm vào bị coi là "bấm ra
 * ngoài" làm đóng bảng trạm. Lồng dialog thì Esc / focus / xếp chồng đã đúng sẵn.
 */
function ZoomViewer({ images, index, title, onClose }: Props) {
  // Ảnh đang hiện — điều khiển index cho Lightbox. Mở lại (index prop đổi) thì về ảnh vừa bấm.
  const [current, setCurrent] = useState(index ?? 0)
  const [openedAt, setOpenedAt] = useState(index)
  if (index !== openedAt) {
    setOpenedAt(index)
    if (index !== null) setCurrent(index)
  }
  // Mảng slides phải GIỮ NGUYÊN qua các lần render: mảng mới mỗi lần (on.view -> setCurrent ->
  // render lại) làm Lightbox reset về index, vuốt sang ảnh khác xong lại bật về ảnh cũ.
  const slides = useMemo(() => images.map((src) => ({ src })), [images])
  const many = images.length > 1

  return (
    <DialogPrimitive.Root open={index !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 bg-black outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          // Focus vào khung ảnh (bàn phím ngoài / màn hẹp trên máy tính), không vào nút đóng.
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).querySelector<HTMLElement>('.yarl__container')?.focus()
          }}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {L.zoomHint}
          </DialogPrimitive.Description>

          {index !== null && (
            <Lightbox
              plugins={[Inline, Zoom]}
              inline={{ style: { position: 'absolute', inset: 0 } }}
              open
              close={onClose}
              index={current}
              slides={slides}
              on={{ view: ({ index: i }) => setCurrent(i) }}
              carousel={{ finite: true, padding: 0, spacing: 16 }}
              controller={{ closeOnPullDown: true }}
              zoom={{
                // Mặc định 1 = dừng khi 1 pixel ảnh = 1 pixel thật: ảnh 1276px trên máy DPR 3
                // gần như không phóng thêm được. Cho tới 3 lần để đọc được chữ trên biển.
                maxZoomPixelRatio: 3,
                doubleClickMaxStops: 2,
                scrollToZoom: true,
              }}
              render={{
                ...(coarse || !many ? { buttonPrev: () => null, buttonNext: () => null } : {}),
                ...(coarse ? { buttonZoom: () => null } : {}),
              }}
              labels={{ Previous: L.prev, Next: L.next, 'Zoom in': L.zoomIn, 'Zoom out': L.zoomOut }}
              // Toolbar (nút +− trên máy tính) xuống đáy: góc trên phải là nút đóng của ta.
              styles={{ container: { backgroundColor: '#000' }, toolbar: { top: 'auto', bottom: 0 } }}
            />
          )}

          {/* Thanh trên: tên trạm + số thứ tự + nút đóng. Nền mờ dần để đọc được trên ảnh sáng. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8 text-white">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{title}</p>
              {many && (
                <p className="text-xs text-white/70" aria-live="polite">
                  {current + 1} / {images.length}
                </p>
              )}
            </div>
            <DialogPrimitive.Close
              className="pointer-events-auto -mt-1 -mr-1 grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-white/15 backdrop-blur transition-colors hover:bg-white/25"
              aria-label={L.close}
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * Bản máy tính: modal, dải ảnh cuộn ngang có snap — mũi tên / phím ←→.
 */
function ModalViewer({ images, index, title, onClose }: Props) {
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

  // ←→ nghe ở window, không qua onKeyDown của dialog: về ảnh đầu/cuối thì nút mũi tên đang
  // giữ focus bị disabled, focus rơi ra body và phím không còn tới dialog nữa.
  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(current - 1)
      if (e.key === 'ArrowRight') go(current + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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
      >
        <DialogTitle className="pr-8 text-base font-semibold">{title}</DialogTitle>
        <DialogDescription className="sr-only">{L.photos}</DialogDescription>

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
                  alt={L.alt(i + 1, images.length)}
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
                aria-label={L.prev}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="secondary"
                size="icon-sm"
                className="absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-full bg-card/85 shadow-md backdrop-blur sm:inline-flex"
                disabled={current === images.length - 1}
                onClick={() => go(current + 1)}
                aria-label={L.next}
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
