import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { StationIndex } from '../data/stations'
import type { Station } from '../data/types'
import { stationIdFromQr } from '@/lib/stationUrl'
import { pick } from '../i18n'
import { AppSheet } from './AppSheet'

const L = pick({
  vi: {
    title: 'Quét mã trạm',
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
    <AppSheet open={open} onClose={onClose} title={L.title} description={L.hint} autoFocus={false}>
      <div className="relative mt-2 aspect-square w-full overflow-hidden rounded-2xl bg-black">
        <video ref={setVideo} className="size-full object-cover" muted playsInline />
        {status === 'starting' && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {L.starting}
          </span>
        )}
        {/* Khung ngắm */}
        {status === 'scanning' && (
          <span aria-hidden className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        )}
      </div>
      {(error || notice) && (
        <p role="alert" className={`mt-2 text-sm ${error ? 'text-destructive' : 'text-warn'}`}>
          {error ?? notice}
        </p>
      )}
    </AppSheet>
  )
}
