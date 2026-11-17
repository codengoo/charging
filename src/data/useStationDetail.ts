import { useEffect, useState } from 'react'
import type { StationDetail } from './types'
import { HttpError, fetchJson } from '../lib/http'

type State = { detail?: StationDetail; loading: boolean; failed: boolean }

/** Đã tải trong phiên này — mở lại trạm cũ không gọi lại (Worker còn cache 6h ở edge). */
const memo = new Map<string, StationDetail | null>()

/**
 * Chi tiết trạm (ảnh, connector, giờ, hotline) từ `/api/station/<id>`. Chỉ gọi khi có trạm
 * đang MỞ — `entityId` null thì không làm gì. Đổi trạm giữa chừng thì huỷ request cũ.
 */
export function useStationDetail(entityId: string | null): State {
  const [state, setState] = useState<State & { id: string | null }>({ id: null, loading: false, failed: false })

  useEffect(() => {
    if (!entityId || memo.has(entityId)) return
    const ctrl = new AbortController()
    setState({ id: entityId, loading: true, failed: false })
    fetchJson<StationDetail>(`/api/station/${encodeURIComponent(entityId)}`, { signal: ctrl.signal })
      .then((detail) => {
        memo.set(entityId, detail)
        setState({ id: entityId, detail, loading: false, failed: false })
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        // 404 = trạm không có chi tiết: nhớ luôn. Lỗi tạm (VinFast chặn, mất mạng): lần mở sau thử tiếp.
        if (e instanceof HttpError && e.status === 404) {
          memo.set(entityId, null)
          return setState({ id: entityId, loading: false, failed: false })
        }
        setState({ id: entityId, loading: false, failed: true })
      })
    return () => ctrl.abort()
  }, [entityId])

  if (!entityId) return { loading: false, failed: false }
  if (memo.has(entityId)) return { detail: memo.get(entityId) ?? undefined, loading: false, failed: false }
  // State của trạm trước chưa kịp thay: coi như đang tải, đừng hiện chi tiết trạm cũ.
  if (state.id !== entityId) return { loading: true, failed: false }
  return state
}
