/**
 * Cloudflare Turnstile (chống bot, thay CAPTCHA) cho form đánh giá. Chỉ bật khi build có
 * `VITE_TURNSTILE_SITEKEY`; không có thì mọi hàm là no-op và Worker cũng không bắt token
 * (Worker chỉ kiểm khi có secret `TURNSTILE_SECRET`). Script tải lười lần đầu cần.
 */
import { useEffect, useRef, useState } from 'react'

const SITEKEY = (import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined)?.trim() || null
export const turnstileEnabled = SITEKEY !== null

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null

function load(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')))
    s.onerror = () => {
      loading = null
      reject(new Error('turnstile'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/**
 * Gắn widget vào `ref` khi `active`. Trả token hiện có (null = chưa xong / hết hạn) và `reset`
 * để lấy token mới sau mỗi lần gửi (token chỉ dùng được một lần).
 */
export function useTurnstile(active: boolean, theme: 'light' | 'dark') {
  const ref = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    if (!SITEKEY || !active || !ref.current) return
    let cancelled = false
    void load()
      .then((ts) => {
        if (cancelled || !ref.current) return
        widget.current = ts.render(ref.current, {
          sitekey: SITEKEY,
          theme,
          size: 'flexible',
          callback: (t: string) => setToken(t),
          'expired-callback': () => setToken(null),
          'error-callback': () => setToken(null),
        })
      })
      .catch(() => setToken(null))
    return () => {
      cancelled = true
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current)
      widget.current = null
      setToken(null)
    }
  }, [active, theme])

  const reset = () => {
    setToken(null)
    if (widget.current && window.turnstile) window.turnstile.reset(widget.current)
  }

  return { ref, token, reset, needed: turnstileEnabled }
}
