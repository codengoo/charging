/**
 * Đánh giá sao + bình luận công khai (worker/reviews.ts). Ẩn danh: máy tự sinh `deviceId` ngẫu
 * nhiên, gửi qua header `X-Device` — server chỉ lưu hash. Chỉ tải khi bảng trạm MỞ.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { pick } from '../i18n'

export interface Review {
  id: number
  nickname: string
  rating: number
  body: string
  createdAt: number
  updatedAt: number
  /** Chỉ có ở bài của mình: đang bị ẩn (do báo cáo / admin). */
  hidden?: boolean
}

export interface ReviewsPage {
  avg: number | null
  count: number
  /** Số đánh giá 1..5 sao. */
  dist: [number, number, number, number, number]
  mine: Review | null
  items: Review[]
  /** Con trỏ trang kế (chuỗi mờ `<updatedAt>_<id>`), null khi hết. */
  next: string | null
}

export interface ReviewInput {
  rating: number
  body: string
  nickname: string
  turnstile?: string | null
}

export class ReviewError extends Error {
  /** Mã HTTP khi lỗi đến từ server; 0 = lỗi mạng. */
  constructor(message: string, readonly status = 0) {
    super(message)
  }
}

const MSG = pick({
  vi: { network: 'Không kết nối được máy chủ, thử lại sau.', generic: 'Có lỗi xảy ra, thử lại sau.' },
  en: { network: "Couldn't reach the server, try again later.", generic: 'Something went wrong, try again later.' },
})

const DEVICE_KEY = 'tramsac.device'
export const NICK_KEY = 'tramsac.nickname'

let memDevice: string | null = null

/** 32 hex ngẫu nhiên, nhớ trong localStorage (không có thì nhớ trong phiên). */
export function deviceId(): string {
  try {
    const v = localStorage.getItem(DEVICE_KEY)
    if (v && /^[0-9a-f]{32}$/.test(v)) return v
  } catch {
    // localStorage bị chặn
  }
  if (!memDevice) {
    const b = crypto.getRandomValues(new Uint8Array(16))
    memDevice = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  }
  try {
    localStorage.setItem(DEVICE_KEY, memDevice)
  } catch {
    // dùng trong phiên
  }
  return memDevice
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'X-Device': deviceId(), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ReviewError(MSG.network)
  }
  if (res.status === 204) return undefined as T
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  // Lỗi từ server đã là câu tiếng Việt cho người dùng (trang /en vẫn hiện tiếng Việt — chấp nhận).
  if (!res.ok) throw new ReviewError(body?.error ?? MSG.generic, res.status)
  return body as T
}

export interface ReviewsState {
  page: ReviewsPage | null
  /** Các trang "Xem thêm" đã tải, nối sau `page.items`. */
  more: Review[]
  /** Con trỏ trang kế (chuỗi mờ `<updatedAt>_<id>`), null khi hết. */
  next: string | null
  loading: boolean
  loadingMore: boolean
  /** Lỗi tải; null khi ổn. `disabled` = server chưa bật đánh giá (503) — ẩn cả khối. */
  error: string | null
  disabled: boolean
}

const EMPTY: ReviewsState = { page: null, more: [], next: null, loading: false, loadingMore: false, error: null, disabled: false }

export function useReviews(entityId: string | null, enabled: boolean) {
  const [state, setState] = useState<ReviewsState>(EMPTY)
  const [nonce, setNonce] = useState(0)
  const shownFor = useRef<string | null>(null)
  // "Xem thêm" đang chạy: đổi trạm / tải lại thì huỷ, không thì trang cũ nối vào trạm mới.
  const moreCtrl = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!enabled || !entityId) return
    const ctrl = new AbortController()
    // Trạm khác: xoá ngay đánh giá của trạm cũ.
    if (shownFor.current !== entityId) setState({ ...EMPTY, loading: true })
    else setState((s) => ({ ...s, loading: true }))
    shownFor.current = entityId
    moreCtrl.current?.abort()
    call<ReviewsPage>(`/api/reviews/${encodeURIComponent(entityId)}`, { signal: ctrl.signal })
      .then((body) => {
        if (!body) throw new ReviewError(MSG.generic)
        setState({ ...EMPTY, page: body, next: body.next })
      })
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return
        if (e instanceof ReviewError && e.status === 503) return setState({ ...EMPTY, disabled: true })
        setState((s) => ({ ...s, loading: false, error: e.message }))
      })
    return () => ctrl.abort()
  }, [entityId, enabled, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => () => moreCtrl.current?.abort(), [])

  const loadMore = useCallback(async () => {
    if (!entityId || state.next === null || state.loadingMore) return
    const ctrl = new AbortController()
    moreCtrl.current = ctrl
    setState((s) => ({ ...s, loadingMore: true }))
    try {
      const p = await call<ReviewsPage>(
        `/api/reviews/${encodeURIComponent(entityId)}?before=${encodeURIComponent(state.next)}`,
        { signal: ctrl.signal },
      )
      if (ctrl.signal.aborted || shownFor.current !== entityId) return
      setState((s) => ({ ...s, more: [...s.more, ...p.items], next: p.next, loadingMore: false }))
    } catch (e) {
      if (ctrl.signal.aborted) return
      setState((s) => ({ ...s, loadingMore: false, error: (e as Error).message }))
    }
  }, [entityId, state.next, state.loadingMore])

  /** Ném ReviewError (câu cho người dùng) khi lỗi; thành công thì tải lại để có điểm TB mới. */
  const save = useCallback(
    async (input: ReviewInput) => {
      if (!entityId) return
      await call<Review>(`/api/reviews/${encodeURIComponent(entityId)}`, { method: 'PUT', body: JSON.stringify(input) })
      try {
        localStorage.setItem(NICK_KEY, input.nickname.trim())
      } catch {
        // không nhớ được biệt danh — lần sau nhập lại
      }
      reload()
    },
    [entityId, reload],
  )

  const remove = useCallback(async () => {
    if (!entityId) return
    await call<void>(`/api/reviews/${encodeURIComponent(entityId)}`, { method: 'DELETE' })
    reload()
  }, [entityId, reload])

  const report = useCallback(async (reviewId: number, turnstile?: string | null) => {
    return call<{ hidden: boolean; already?: boolean }>(`/api/reviews/report/${reviewId}`, {
      method: 'POST',
      body: JSON.stringify({ turnstile }),
    })
  }, [])

  return { ...state, reload, loadMore, save, remove, report }
}

export function savedNickname(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? ''
  } catch {
    return ''
  }
}
