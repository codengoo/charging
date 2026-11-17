import { useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type { StationIndex } from '../data/stations'
import type { Station } from '../data/types'
import { stationIdFromQr } from '@/lib/stationUrl'
import { pick } from '../i18n'

const L = pick({
  vi: {
    title: 'Quét mã trạm',
    close: 'Đóng',
    hint: 'Hướng camera vào mã QR "Link trạm" (in trên thẻ trạm hoặc chia sẻ từ app).',
    starting: 'Đang mở camera…',
    denied: 'Trình duyệt đang chặn camera. Bật lại quyền Camera cho trang này trong cài đặt trình duyệt / điện thoại rồi mở lại.',
    noCamera: 'Không tìm thấy camera trên thiết bị này.',
    failed: 'Không mở được camera — thử lại.',
    notStation: 'Mã này không phải mã trạm của app.',
    unknown: 'Không tìm thấy trạm này trong dữ liệu hiện tại.',
  },
  en: {
    title: 'Scan station code',
    close: 'Close',
    hint: 'Point the camera at a "Station link" QR code (printed on a station card or shared from the app).',
    starting: 'Opening camera…',
    denied: 'Camera access is blocked. Allow Camera for this site in your browser / phone settings, then reopen.',
    noCamera: 'No camera found on this device.',
    failed: "Couldn't open the camera — try again.",
    notStation: "This isn't a station code from this app.",
    unknown: "This station isn't in the current data.",
  },
})

type Status = 'starting' | 'scanning' | 'denied' | 'noCamera' | 'failed'

interface Props {
  open: boolean
  onClose: () => void
  index: StationIndex
  onFound: (st: Station) => void
}

/**
 * Bảng camera quét QR trạm. `qr-scanner` nạp lười khi mở (dùng BarcodeDetector nếu trình duyệt có,
 * không thì bộ giải mã JS trong web worker — iOS Safari). Quét trúng mã trạm thì gọi `onFound`;
 * mã khác thì báo và quét tiếp.
 */
export function QrScanSheet({ open, onClose, index, onFound }: Props) {
  // Callback ref: <video> chỉ có trong DOM khi bảng đã mở.
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState<Status>('starting')
  const [notice, setNotice] = useState<string | null>(null)
  const latest = useRef({ index, onFound })
  latest.current = { index, onFound }

  useEffect(() => {
    if (!open || !video) return
    let stopped = false
    let scanner: { stop(): void; destroy(): void } | null = null
    setStatus('starting')
    setNotice(null)

    void (async () => {
      try {
        const { default: QrScanner } = await import('qr-scanner')
        if (stopped) return
        if (!(await QrScanner.hasCamera())) {
          if (!stopped) setStatus('noCamera')
          return
        }
        const s = new QrScanner(
          video,
          (result) => {
            const id = stationIdFromQr(result.data)
            if (!id) return setNotice(L.notStation)
            const st = latest.current.index.byId.get(id)
            if (!st) return setNotice(L.unknown)
            s.stop()
            latest.current.onFound(st)
          },
          { preferredCamera: 'environment', returnDetailedScanResult: true, maxScansPerSecond: 8 },
        )
        scanner = s
        await s.start()
        if (stopped) s.destroy()
        else setStatus('scanning')
      } catch {
        if (stopped) return
        // qr-scanner gộp mọi lỗi mở camera thành "Camera not found." — đã biết máy CÓ camera (hasCamera)
        // thì gần như chắc là bị chặn quyền; hỏi thêm Permissions API cho chắc (Safari 16+, Chrome có).
        const perm = await navigator.permissions?.query({ name: 'camera' as PermissionName }).catch(() => null)
        if (!stopped) setStatus(perm?.state === 'granted' ? 'failed' : 'denied')
      }
    })()

    return () => {
      stopped = true
      scanner?.destroy()
    }
  }, [open, video])

  const error = status === 'denied' ? L.denied : status === 'noCamera' ? L.noCamera : status === 'failed' ? L.failed : null

  return (
    // Hộp thoại (không phải drawer): điện thoại toàn màn hình nền đen, camera chiếm phần lớn khung;
    // màn rộng là hộp thoại giữa màn hình.
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-50 flex flex-col bg-black pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom))] text-white outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:bg-popover sm:p-5 sm:text-popover-foreground sm:shadow-xl"
        >
          <div className="flex items-start gap-3 px-4 pt-3 sm:px-0 sm:pt-0">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-lg font-semibold">{L.title}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-sm text-white/70 sm:text-muted-foreground">
                {L.hint}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label={L.close}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:size-8 sm:bg-transparent sm:text-muted-foreground sm:hover:bg-muted"
            >
              <X className="size-5 sm:size-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Điện thoại: camera lấp phần còn lại của màn hình; màn rộng: khung vuông. */}
          <div className="relative mt-3 min-h-0 flex-1 overflow-hidden bg-black sm:aspect-square sm:flex-none sm:rounded-2xl">
            <video ref={setVideo} className="size-full object-cover" muted playsInline />
            {status === 'starting' && (
              <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
                <Loader2 className="size-4 animate-spin" aria-hidden /> {L.starting}
              </span>
            )}
            {/* Khung ngắm vuông giữa khung hình */}
            {status === 'scanning' && (
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-1/2 aspect-square w-[64%] max-w-72 -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
              />
            )}
          </div>
          {(error || notice) && (
            <p
              role="alert"
              className={`mx-4 mt-3 rounded-xl px-3 py-2 text-sm sm:mx-0 ${
                error ? 'bg-destructive/15 text-red-300 sm:text-destructive' : 'bg-white/10 text-amber-300 sm:bg-transparent sm:px-0 sm:text-warn'
              }`}
            >
              {error ?? notice}
            </p>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
