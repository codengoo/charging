import { useEffect, useState } from 'react'
import { CheckIcon, CopyIcon, DownloadIcon, Link2, MapPinned, Share2Icon } from 'lucide-react'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { useIsMobile } from '@/hooks/use-media-query'
import { googleMapsUrl, slugify, stationShareUrl } from '@/lib/stationUrl'
import { downloadBlob, drawQr, renderQrCard } from '@/lib/qrCard'
import type { Station } from '../data/types'
import { pick } from '../i18n'

type Mode = 'app' | 'maps'

const L = pick({
  vi: {
    appLabel: 'Link trạm',
    appDescription: 'Quét mã hoặc gửi link. Người nhận mở thẳng trạm này trên Bản đồ trạm sạc.',
    appCaption: 'Quét để mở trạm trên Bản đồ trạm sạc',
    mapsDescription: 'Quét mã hoặc gửi link để mở đúng vị trí trạm trên Google Maps và chỉ đường.',
    mapsCaption: 'Quét để mở vị trí trên Google Maps',
    title: 'Chia sẻ trạm',
    modeLabel: 'Loại link chia sẻ',
    qrAria: (caption: string) => `Mã QR: ${caption}`,
    linkAria: 'Link chia sẻ',
    copied: 'Đã chép',
    copy: 'Sao chép',
    downloadQr: 'Tải ảnh QR',
    copiedMessage: 'Đã chép lời nhắn',
    share: 'Chia sẻ…',
  },
  en: {
    appLabel: 'Station link',
    appDescription: 'Scan the code or send the link. The recipient opens this station directly on VinFast Charging Map.',
    appCaption: 'Scan to open the station on VinFast Charging Map',
    mapsDescription: 'Scan the code or send the link to open the exact station location in Google Maps and get directions.',
    mapsCaption: 'Scan to open the location in Google Maps',
    title: 'Share station',
    modeLabel: 'Share link type',
    qrAria: (caption: string) => `QR code: ${caption}`,
    linkAria: 'Share link',
    copied: 'Copied',
    copy: 'Copy',
    downloadQr: 'Download QR image',
    copiedMessage: 'Message copied',
    share: 'Share…',
  },
})

const MODES: Record<Mode, { label: string; icon: typeof Link2; description: string; caption: string }> = {
  app: {
    label: L.appLabel,
    icon: Link2,
    description: L.appDescription,
    caption: L.appCaption,
  },
  maps: {
    label: 'Google Maps',
    icon: MapPinned,
    description: L.mapsDescription,
    caption: L.mapsCaption,
  },
}

/** Màu tiêu đề trên ảnh QR tải về — xanh brand. */
const BRAND_HEX = '#009966'

interface Props {
  /** Giữ component gắn và chỉ đổi `open` — gỡ hẳn khi đóng thì mất hiệu ứng trôi xuống. */
  open: boolean
  station: Station
  onClose: () => void
}

/**
 * Chia sẻ một trạm: link app (có preview khi gửi qua Zalo/Messenger) hoặc vị trí Google Maps.
 * Bố cục theo hộp "Mời bạn" của chiatien — xem design.md, mục "Chia sẻ / QR".
 */
export function ShareSheet({ open, station, onClose }: Props) {
  const isMobile = useIsMobile()
  const qrDisplaySize = isMobile ? 168 : 208
  const [mode, setMode] = useState<Mode>('app')
  const [copied, setCopied] = useState(false)
  const [sharedHint, setSharedHint] = useState(false)
  // Callback ref vào state: nội dung drawer gắn vào DOM sau lần render đầu.
  const [qr, setQr] = useState<HTMLCanvasElement | null>(null)

  const link = mode === 'app' ? stationShareUrl(station) : googleMapsUrl(station)
  const meta = MODES[mode]

  useEffect(() => {
    if (!qr) return
    // Thư viện qrcode tự đặt style.width = 480px lên canvas — gán lại cỡ hiển thị sau khi vẽ.
    void drawQr(qr, link).then(() => {
      qr.style.width = qr.style.height = `${qrDisplaySize}px`
    })
    setCopied(false)
  }, [qr, link, qrDisplaySize])

  const fileName = `tramsac-${mode === 'maps' ? 'maps-' : ''}${slugify(station.name) || station.entityId}.png`
  const qrImage = () => {
    if (!qr) throw new Error('Không tạo được ảnh QR')
    return renderQrCard(qr, station.name, [meta.caption], BRAND_HEX)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // Trình duyệt chặn clipboard — ô link vẫn chọn tay được.
    }
  }

  async function share() {
    const shareText = `${station.name} — ${station.address}\n${link}`

    // Desktop / trình duyệt không có Web Share: chép lời nhắn + link để dán vào Zalo, Messenger.
    if (typeof navigator.share !== 'function') {
      try {
        await navigator.clipboard.writeText(shareText)
        setSharedHint(true)
        window.setTimeout(() => setSharedHint(false), 2000)
      } catch {
        // bỏ qua
      }
      return
    }

    try {
      const file = new File([await qrImage()], fileName, { type: 'image/png' })
      const data = { title: station.name, text: shareText, url: link, files: [file] }
      // Kèm ảnh QR nếu máy cho chia sẻ file; không thì chỉ link.
      if (navigator.canShare?.(data)) await navigator.share(data)
      else await navigator.share({ title: station.name, text: shareText, url: link })
    } catch {
      // Người dùng huỷ bảng chia sẻ — không phải lỗi.
    }
  }

  return (
    <ResponsiveDialog nested open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <ResponsiveDialogHeader className="gap-1 pr-6 text-left">
          <ResponsiveDialogTitle className="text-base font-bold sm:text-lg">{L.title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-xs sm:text-sm">{meta.description}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {/* Một cột nhịp đều gap-3/sm:gap-4 cho cả drawer (mobile) lẫn dialog (desktop). */}
        <div className="mt-3 flex flex-col gap-3 sm:mt-0 sm:gap-4">
          <Segmented
            label={L.modeLabel}
            value={mode}
            onChange={setMode}
            options={(Object.keys(MODES) as Mode[]).map((m) => ({ value: m, label: MODES[m].label, icon: MODES[m].icon }))}
          />

          {/* Nền trắng cố định (kể cả chế độ tối) để camera quét dễ. */}
          <div className="mx-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-foreground/10 sm:p-4">
            <canvas
              ref={setQr}
              role="img"
              aria-label={L.qrAria(meta.caption)}
              style={{ width: qrDisplaySize, height: qrDisplaySize }}
              className="block"
            />
          </div>

          <div className="flex min-w-0 gap-2">
            <Input
              className="min-w-0 truncate"
              readOnly
              value={link}
              onClick={(e) => e.currentTarget.select()}
              aria-label={L.linkAria}
            />
            <Button onClick={copy} variant={copied ? 'secondary' : 'default'} className="shrink-0">
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? L.copied : L.copy}
            </Button>
          </div>

          <div className="flex gap-2 pt-1 *:flex-1">
            <Button
              variant="outline"
              className="h-10 text-xs font-medium sm:text-sm"
              onClick={async () => downloadBlob(await qrImage(), fileName)}
            >
              <DownloadIcon className="size-4" /> {L.downloadQr}
            </Button>
            <Button variant="outline" className="h-10 text-xs font-medium sm:text-sm" onClick={share}>
              {sharedHint ? <CheckIcon className="size-4" /> : <Share2Icon className="size-4" />}
              {sharedHint ? L.copiedMessage : L.share}
            </Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
