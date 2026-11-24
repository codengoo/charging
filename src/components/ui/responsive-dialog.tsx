import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerNestedRoot,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

interface ResponsiveDialogContextValue {
  isMobile: boolean
  /** Drawer đang ở chế độ snap (nội dung dài) — do nội dung báo lên qua setLong. */
  long: boolean
  setLong: (long: boolean) => void
  /** Đang ở mốc snap cao nhất — chỉ khi đó khung nội dung mới được cuộn. */
  atTop: boolean
  /** Kéo drawer lên mốc cao nhất (vd. khi focus ô nhập — bàn phím sắp che nửa dưới). */
  expand: () => void
  /** Có bảng con (nested) đang mở chồng lên bảng này — màn rộng thu nhỏ bảng cha lùi ra sau. */
  stacked: boolean
  registerChild: (delta: 1 | -1) => void
}

const ResponsiveDialogContext = React.createContext<ResponsiveDialogContextValue>({
  isMobile: false,
  long: false,
  setLong: () => {},
  atTop: false,
  expand: () => {},
  stacked: false,
  registerChild: () => {},
})

/**
 * Drawer điện thoại có nội dung dài: hai mốc snap của vaul — 60% màn hình lúc mở và gần full (sát dưới
 * status bar). Với snapPoints, vaul tự chia cử chỉ: chưa ở mốc cao nhất thì vuốt trong nội dung là
 * KÉO DRAWER; ở mốc cao nhất mới cuộn nội dung; nội dung ở top mà vuốt xuống thì drawer hạ.
 * Nội dung ngắn hơn 60% thì không snap (drawer cao vừa nội dung như cũ).
 */
const SNAP_COMPACT = 0.6
const SNAP_POINTS = [SNAP_COMPACT, 1]
/** Chiều cao drawer khi snap (mốc 1 = hiện trọn drawer): sát dưới status bar. */
const SHEET_FULL = 'calc(100dvh - env(safe-area-inset-top) - 8px)'
/** Ô nhập mở bàn phím (không tính checkbox / radio / thanh trượt). */
const EDITABLE = 'input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, [contenteditable="true"]'
/** Khung drawer bên ngoài khung nội dung không được cuộn (overflow-hidden) — trình duyệt focus / cuộn ô nhập vẫn có thể
 * cuộn nó lệch đi, kéo tay cầm + tiêu đề ra khỏi màn hình. Đưa về 0. */
function resetOuter(box: HTMLElement) {
  for (let el = box.parentElement; el && el !== document.body; el = el.parentElement) {
    if (el.scrollTop !== 0) el.scrollTop = 0
  }
}

/** Ngón tay dịch quá chừng này (px) giữa lúc chạm và nhấc thì là kéo / cuộn, không phải chạm. */
const TAP_SLOP_PX = 10
/** Ô nhập được focus cuộn tới cách đầu khung nội dung chừng này (px) — chừa nhãn của ô. */
const FOCUS_TOP_PX = 80
/** Phần ngoài nội dung: tay cầm (~30px) + đệm đáy (2.5rem). */
const SHEET_CHROME_PX = 30 + 40

export interface ResponsiveDialogProps {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  modal?: boolean
  nested?: boolean
  /**
   * false = không bao giờ dùng hai mốc snap: drawer cao vừa nội dung (≤ 92dvh), nội dung luôn cuộn.
   * Dùng cho bảng có NHIỀU Ô NHẬP — vaul chỉ đẩy drawer lên trên bàn phím iOS ở chế độ không snap;
   * ở mốc 60% bàn phím che mất ô đang nhập.
   */
  snap?: boolean
}

export function ResponsiveDialog({
  children,
  open,
  onOpenChange,
  snap: allowSnap = true,
  ...props
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()
  const parent = React.useContext(ResponsiveDialogContext)
  const [longRaw, setLongRaw] = React.useState(false)
  const long = allowSnap && longRaw
  const setLong = setLongRaw
  const [childCount, setChildCount] = React.useState(0)
  const registerChild = React.useCallback((d: 1 | -1) => setChildCount((n) => Math.max(0, n + d)), [])
  // Bảng con mở chồng: báo bảng cha để nó lùi ra sau (màn rộng); điện thoại do vaul NestedRoot lo.
  const nested = props.nested
  const registerInParent = parent.registerChild
  React.useEffect(() => {
    if (!nested || !open) return
    registerInParent(1)
    return () => registerInParent(-1)
  }, [nested, open, registerInParent])
  const [snap, setSnap] = React.useState<number | string | null>(SNAP_COMPACT)
  // Mỗi lần mở lại bắt đầu ở mốc thấp; đóng thì bỏ chế độ snap (lần mở sau đo lại từ đầu).
  React.useEffect(() => {
    if (open) setSnap(SNAP_COMPACT)
    else setLong(false)
  }, [open])
  const atTop = snap === SNAP_POINTS[SNAP_POINTS.length - 1]
  const expand = React.useCallback(() => setSnap(SNAP_POINTS[SNAP_POINTS.length - 1]), [])
  const stacked = childCount > 0
  const ctx = React.useMemo(
    () => ({ isMobile, long, setLong, atTop, expand, stacked, registerChild }),
    [isMobile, long, atTop, expand, stacked, registerChild],
  )
  // DialogProps của vaul là union (có/không fadeFromIndex) — props snap có điều kiện phải ép kiểu.
  const drawerProps = {
    open,
    onOpenChange,
    ...(long ? { snapPoints: SNAP_POINTS, activeSnapPoint: snap, setActiveSnapPoint: setSnap, fadeFromIndex: 0 } : {}),
    ...props,
  } as React.ComponentProps<typeof Drawer>

  return (
    <ResponsiveDialogContext.Provider value={ctx}>
      {isMobile ? (
        nested ? (
          // vaul NestedRoot: bảng cha tự thu nhỏ, lùi ra sau khi bảng con mở (như Chia Tiền).
          <DrawerNestedRoot {...drawerProps}>{children}</DrawerNestedRoot>
        ) : (
          <Drawer {...drawerProps}>{children}</Drawer>
        )
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange} {...props}>
          {children}
        </Dialog>
      )}
    </ResponsiveDialogContext.Provider>
  )
}

export interface ResponsiveDialogContentProps
  extends React.ComponentProps<typeof DialogContent> {
  showCloseButton?: boolean
  showHandle?: boolean
}

export function ResponsiveDialogContent({
  className,
  children,
  showCloseButton = true,
  showHandle = true,
  ...props
}: ResponsiveDialogContentProps) {
  const { isMobile, long, setLong, atTop, expand, stacked } = React.useContext(ResponsiveDialogContext)
  // Callback ref (state): component này dựng sẵn khi drawer còn đóng, lớp đo chỉ xuất hiện lúc mở.
  const [measureEl, measureRef] = React.useState<HTMLDivElement | null>(null)
  const [typing, setTyping] = React.useState(false)
  const tapStart = React.useRef<{ x: number; y: number } | null>(null)

  // Đo chiều cao tự nhiên của nội dung (lớp bọc bên trong, không phụ thuộc chiều cao drawer) để
  // quyết định có snap không. Theo dõi cả khi nội dung tải thêm (live, đánh giá…).
  React.useEffect(() => {
    const el = measureEl
    if (!isMobile || !el) return
    // Chỉ BẬT snap khi đang mở, không tắt: nội dung đang dài mà ngắn lại (vd. đổi xe trong Xe của bạn)
    // thì bỏ snapPoints khiến vaul trên Safari iOS giữ nguyên độ dịch của mốc 60% — drawer (giờ cao vừa
    // nội dung) bị đẩy khuất dưới màn hình. Tắt snap khi đóng (xem ResponsiveDialog).
    const check = () => {
      if (el.offsetHeight + SHEET_CHROME_PX > window.innerHeight * SNAP_COMPACT) setLong(true)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    window.addEventListener('resize', check)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [isMobile, setLong, measureEl])

  if (isMobile) {
    return (
      <DrawerContent
        showHandle={showHandle}
        className={cn('p-0 !overflow-hidden', className, '!overflow-hidden')}
        {...props}
        // Snap: drawer cao cố định (mốc 1 = hiện trọn), vaul dịch xuống cho mốc 60%.
        style={long ? { ...props.style, height: SHEET_FULL, maxHeight: 'none' } : props.style}
        data-stacked={stacked || undefined}
      >
        <div
          // Không snap thì nội dung không kéo drawer (như cũ); snap thì để vaul chia cử chỉ.
          data-vaul-no-drag={long ? undefined : true}
          // Focus ô nhập: ở mốc 60% khung nội dung khoá cuộn → bàn phím iOS che mất ô đang nhập mà trình
          // duyệt không cuộn tới được. Kéo lên mốc cao nhất (mở khoá cuộn) rồi, khi bàn phím đã bật (~350 ms),
          // cuộn cho ô nằm gần ĐẦU khung (bàn phím số iPhone chiếm gần nửa dưới — "giữa" vẫn sát mép phím).
          onFocus={(e) => {
            const t = e.target as HTMLElement
            if (!t.matches(EDITABLE)) return
            const box = e.currentTarget
            setTyping(true)
            if (long && !atTop) expand()
            // Chờ drawer kéo lên xong + bàn phím bật rồi cuộn RIÊNG khung nội dung (không dùng scrollIntoView:
            // nó cuộn cả khung drawer bên ngoài vốn overflow-hidden — tay cầm + tiêu đề trôi khỏi màn hình và
            // không về lại). Khung ngoài bị iOS / trình duyệt cuộn lệch thì kéo về 0.
            window.setTimeout(() => {
              if (document.activeElement !== t) return
              resetOuter(box)
              const y = t.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - FOCUS_TOP_PX
              box.scrollTo({ top: Math.max(0, y) })
            }, 450)
          }}
          onBlur={(e) => {
            // Chuyển sang ô nhập khác trong cùng drawer thì giữ khoảng trống.
            const next = e.relatedTarget as HTMLElement | null
            if (!next || !next.matches(EDITABLE) || !e.currentTarget.contains(next)) setTyping(false)
            resetOuter(e.currentTarget)
          }}
          tabIndex={-1}
          // iOS chỉ bỏ focus khi chạm vào phần tử nhận focus — chạm chữ / chỗ trống thì ô vẫn giữ focus,
          // bàn phím không đóng. Chạm (không phải kéo cuộn) ra ngoài ô nhập → blur. Dùng pointer events vì
          // iOS không phát click cho phần tử không "bấm được".
          onPointerDown={(e) => {
            tapStart.current = { x: e.clientX, y: e.clientY }
          }}
          onPointerUp={(e) => {
            const start = tapStart.current
            tapStart.current = null
            if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP_PX) return
            const active = document.activeElement as HTMLElement | null
            const t = e.target as HTMLElement
            if (!active?.matches(EDITABLE) || !e.currentTarget.contains(active)) return
            // Chạm vào ô nhập khác / nhãn của ô thì để trình duyệt chuyển focus như thường.
            if (t.closest('input, textarea, label, [contenteditable="true"]')) return
            // Không blur() ra <body>: Radix Dialog giữ focus trong hộp thoại và trả focus về ô vừa rời. Chuyển
            // focus sang chính khung nội dung (tabIndex -1) — vẫn trong hộp thoại, ô nhập mất focus, phím đóng.
            e.currentTarget.focus({ preventScroll: true })
          }}
          className={cn(
            'sheet-stagger flex-1 min-h-0 overflow-x-hidden no-scrollbar outline-none px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] touch-pan-y',
            // Snap: chỉ cuộn khi ở mốc cao nhất; mốc thấp thì cú vuốt hoàn toàn là của drawer (vaul).
            !long || atTop ? 'overflow-y-auto' : 'overflow-y-hidden',
          )}
        >
          <div ref={measureRef}>{children}</div>
          {/* Đang gõ: khoảng trống cuối nội dung để cả ô CUỐI cũng cuộn được lên trên bàn phím. Nằm ngoài
              lớp đo nên không làm đổi chế độ snap. */}
          {typing && <div aria-hidden className="h-[80dvh]" />}
        </div>
      </DrawerContent>
    )
  }

  return (
    <DialogContent className={className} showCloseButton={showCloseButton} data-stacked={stacked || undefined} {...props}>
      {children}
    </DialogContent>
  )
}

export function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)

  if (isMobile) {
    return (
      <DrawerHeader className={cn('px-0 pt-0 text-left', className)} {...props} />
    )
  }

  return <DialogHeader className={className} {...props} />
}

export function ResponsiveDialogFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)

  if (isMobile) {
    return (
      <DrawerFooter
        className={cn(
          '-mx-5 -mb-4 mt-4 border-t bg-muted/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
          className
        )}
        {...props}
      />
    )
  }

  return <DialogFooter className={className} {...props} />
}

export function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)

  if (isMobile) {
    return <DrawerTitle className={className} {...props} />
  }

  return <DialogTitle className={className} {...props} />
}

export function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)

  if (isMobile) {
    return <DrawerDescription className={className} {...props} />
  }

  return <DialogDescription className={className} {...props} />
}
