import { useEffect, useRef, useState } from 'react'
import { CheckIcon, CopyIcon, DownloadIcon, Share2Icon, Upload } from 'lucide-react'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useIsMobile } from '@/hooks/use-media-query'
import { downloadBlob, drawQr } from '@/lib/qrCard'
import { shareOrigin } from '@/lib/stationUrl'
import { allSaved, type GroupBook } from '../data/groups'
import { QR_MAX, backupUrl, readBackupFile, toBackup } from '../data/backup'

interface Props {
  /** Giữ component gắn và chỉ đổi `open` — gỡ hẳn khi đóng thì mất hiệu ứng trôi xuống. */
  open: boolean
  book: GroupBook
  /** Đã đọc được file sao lưu — App mở hộp xác nhận gộp. null = file không đọc được. */
  onImportFile: (incoming: GroupBook | null) => void
  onClose: () => void
}

/** Sao lưu / chuyển sổ nhóm: QR + link `#import=`, tải file .json, nhập từ file. */
export function BackupSheet({ open, book, onImportFile, onClose }: Props) {
  const isMobile = useIsMobile()
  const qrDisplaySize = isMobile ? 168 : 208
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState<HTMLCanvasElement | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const stations = allSaved(book).size
  const customGroups = book.groups.filter((g) => !g.builtIn).length

  // Dựng link mỗi lần mở (sổ có thể đã đổi). Nén là bất đồng bộ nên giữ trong state.
  useEffect(() => {
    if (!open) return
    let alive = true
    setCopied(false)
    void backupUrl(shareOrigin(), book).then((u) => alive && setLink(u))
    return () => {
      alive = false
    }
  }, [open, book])

  const showQr = link !== null && link.length <= QR_MAX
  useEffect(() => {
    if (!qr || !link || !showQr) return
    // Thư viện qrcode tự đặt style.width = 480px lên canvas — gán lại cỡ hiển thị sau khi vẽ.
    void drawQr(qr, link).then(() => {
      qr.style.width = qr.style.height = `${qrDisplaySize}px`
    })
  }, [qr, link, showQr, qrDisplaySize])

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // Trình duyệt chặn clipboard — ô link vẫn chọn tay được.
    }
  }

  async function share() {
    if (!link) return
    try {
      await navigator.share({ title: 'Trạm sạc đã lưu', text: 'Mở link để chép các trạm đã lưu sang máy này', url: link })
    } catch {
      // Người dùng huỷ — không phải lỗi.
    }
  }

  function downloadFile() {
    const blob = new Blob([JSON.stringify(toBackup(book), null, 1)], { type: 'application/json' })
    const d = new Date()
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    downloadBlob(blob, `tramsac-nhom-${ymd}.json`)
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // chọn lại cùng file vẫn kích hoạt onChange
    if (file) onImportFile(await readBackupFile(file))
  }

  return (
    <ResponsiveDialog nested open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <ResponsiveDialogHeader className="gap-1 pr-6 text-left">
          <ResponsiveDialogTitle className="text-base font-bold sm:text-lg">Sao lưu / chuyển máy</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-xs sm:text-sm">
            {stations} trạm{customGroups ? `, ${customGroups} nhóm tự tạo` : ''}. Mở link hoặc quét mã trên máy kia để
            gộp vào — trạm đã lưu sẵn ở máy đó giữ nguyên.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="mt-3 flex flex-col gap-3 sm:mt-0 sm:gap-4">
          {showQr ? (
            // Nền trắng cố định (kể cả chế độ tối) để camera quét dễ.
            <div className="mx-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-foreground/10 sm:p-4">
              <canvas
                ref={setQr}
                role="img"
                aria-label="Mã QR sao lưu trạm đã lưu"
                style={{ width: qrDisplaySize, height: qrDisplaySize }}
                className="block"
              />
            </div>
          ) : (
            link && (
              <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                Nhiều trạm quá nên mã QR sẽ khó quét — gửi link hoặc file thay vào đó.
              </p>
            )
          )}

          <div className="flex min-w-0 gap-2">
            <Input
              className="min-w-0 truncate"
              readOnly
              value={link ?? ''}
              onClick={(e) => e.currentTarget.select()}
              aria-label="Link sao lưu"
            />
            <Button onClick={copy} disabled={!link} variant={copied ? 'secondary' : 'default'} className="shrink-0">
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? 'Đã chép' : 'Sao chép'}
            </Button>
          </div>

          <div className="flex gap-2 pt-1 *:flex-1">
            {typeof navigator.share === 'function' && (
              <Button variant="outline" className="h-10 text-xs font-medium sm:text-sm" disabled={!link} onClick={share}>
                <Share2Icon className="size-4" /> Chia sẻ…
              </Button>
            )}
            <Button variant="outline" className="h-10 text-xs font-medium sm:text-sm" onClick={downloadFile}>
              <DownloadIcon className="size-4" /> Tải file
            </Button>
            <Button variant="outline" className="h-10 text-xs font-medium sm:text-sm" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Nhập từ file…
            </Button>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={pickFile} />
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
