import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '@/hooks/use-media-query'
import { drawQr } from '@/lib/qrCard'

/**
 * Canvas QR cho `text` (null = chưa vẽ). Trả `ref` (callback ref — nội dung drawer gắn vào DOM
 * sau lần render đầu nên phải là state), `canvas` để xuất ảnh, `size` cỡ hiển thị (px).
 */
export function useQrCanvas(text: string | null) {
  const size = useIsMobile() ? 168 : 208
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  useEffect(() => {
    if (!canvas || !text) return
    // Thư viện qrcode tự đặt style.width = 480px lên canvas — gán lại cỡ hiển thị sau khi vẽ.
    void drawQr(canvas, text).then(() => {
      canvas.style.width = canvas.style.height = `${size}px`
    })
  }, [canvas, text, size])
  return { ref: setCanvas, canvas, size }
}

/** Nút "Chép": `copied` bật sau khi chép, tự tắt khi `text` đổi. Trình duyệt chặn clipboard thì im lặng — ô link vẫn chọn tay được. */
export function useCopy(text: string | null) {
  const [copied, setCopied] = useState(false)
  useEffect(() => setCopied(false), [text])
  const copy = async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // bỏ qua
    }
  }
  return { copied, copy, reset: () => setCopied(false) }
}

/** Cờ bật trong `ms` rồi tự tắt (gỡ component thì huỷ hẹn giờ). */
export function useFlash(ms = 2000) {
  const [on, setOn] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const flash = () => {
    setOn(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOn(false), ms)
  }
  return { on, flash }
}
