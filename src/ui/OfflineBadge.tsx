import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'
import { pick } from '../i18n'

const L = pick({
  vi: { offline: 'Đang offline — dùng dữ liệu đã lưu trên máy' },
  en: { offline: "You're offline — using data saved on this device" },
})

const subscribe = (onChange: () => void) => {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/**
 * Nhãn nổi khi mất mạng. Bản đồ khu đã xem, trạm, hành trình vừa mở vẫn dùng được nhờ service worker
 * (vite.config.ts); cổng trống thời gian thực và đánh giá thì không.
 */
export function OfflineBadge() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine)
  if (online) return null
  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-1.5 self-start rounded-full bg-foreground/85 px-3 py-1.5 text-xs font-medium text-background shadow-lg"
    >
      <WifiOff className="size-3.5" aria-hidden />
      {L.offline}
    </div>
  )
}
