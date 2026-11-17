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
  /** Có bảng con (nested) đang mở chồng lên bảng này — màn rộng thu nhỏ bảng cha lùi ra sau. */
  stacked: boolean
  registerChild: (delta: 1 | -1) => void
}

const ResponsiveDialogContext = React.createContext<ResponsiveDialogContextValue>({
  isMobile: false,
  long: false,
  setLong: () => {},
  atTop: false,
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
/** Phần ngoài nội dung: tay cầm (~30px) + đệm đáy (2.5rem). */
const SHEET_CHROME_PX = 30 + 40

export interface ResponsiveDialogProps {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  modal?: boolean
  nested?: boolean
}

export function ResponsiveDialog({
  children,
  open,
  onOpenChange,
  ...props
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()
  const parent = React.useContext(ResponsiveDialogContext)
  const [long, setLong] = React.useState(false)
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
  // Mỗi lần mở lại bắt đầu ở mốc thấp.
  React.useEffect(() => {
    if (open) setSnap(SNAP_COMPACT)
  }, [open])
  const atTop = snap === SNAP_POINTS[SNAP_POINTS.length - 1]
  const stacked = childCount > 0
  const ctx = React.useMemo(
    () => ({ isMobile, long, setLong, atTop, stacked, registerChild }),
    [isMobile, long, atTop, stacked, registerChild],
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
  const { isMobile, long, setLong, atTop, stacked } = React.useContext(ResponsiveDialogContext)
  // Callback ref (state): component này dựng sẵn khi drawer còn đóng, lớp đo chỉ xuất hiện lúc mở.
  const [measureEl, measureRef] = React.useState<HTMLDivElement | null>(null)

  // Đo chiều cao tự nhiên của nội dung (lớp bọc bên trong, không phụ thuộc chiều cao drawer) để
  // quyết định có snap không. Theo dõi cả khi nội dung tải thêm (live, đánh giá…).
  React.useEffect(() => {
    const el = measureEl
    if (!isMobile || !el) return
    const check = () => setLong(el.offsetHeight + SHEET_CHROME_PX > window.innerHeight * SNAP_COMPACT)
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
          className={cn(
            'sheet-stagger flex-1 min-h-0 overflow-x-hidden no-scrollbar px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] touch-pan-y',
            // Snap: chỉ cuộn khi ở mốc cao nhất; mốc thấp thì cú vuốt hoàn toàn là của drawer (vaul).
            !long || atTop ? 'overflow-y-auto' : 'overflow-y-hidden',
          )}
        >
          <div ref={measureRef}>{children}</div>
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
