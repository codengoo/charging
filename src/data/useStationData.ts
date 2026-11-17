import { useEffect, useRef, useState } from 'react'
import { loadManifest, loadPower, loadStations, type StationIndex } from './stations'
import type { StationPower } from './types'
import { dataKey } from './format'

/**
 * Bao lâu mới hỏi lại manifest khi người dùng quay lại tab. Builder chạy mỗi ngày một lần,
 * manifest trên CDN cache 5 phút — hỏi dày hơn chỉ tốn request.
 */
const RECHECK_MS = 30 * 60_000

/**
 * Dữ liệu trạm từ CDN (`/data/*`, Worker đọc R2 do GitHub Action làm mới mỗi ngày):
 *
 * 1. manifest → base: có là vẽ bản đồ ngay.
 * 2. power (số cổng, kW) tải ngầm sau — không chặn lần vẽ đầu.
 * 3. Tab để mở lâu: quay lại tab thì hỏi manifest; tên file base/power đổi thì tải lại và thay chỉ mục.
 *    Trạm đang chọn / nhóm đã lưu giữ nguyên vì cùng `entityId` qua các generation.
 */
export function useStationData() {
  const [index, setIndex] = useState<StationIndex | null>(null)
  const [power, setPower] = useState<Map<string, StationPower> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastCheck = useRef(0)
  const loading = useRef(false)
  /** dataKey của bản đang hiển thị — đọc trong handler mà không cần đưa index vào deps. */
  const shownKey = useRef('')

  useEffect(() => {
    let alive = true

    async function apply(next: StationIndex) {
      if (!alive) return
      const key = dataKey(next.manifest)
      shownKey.current = key
      setIndex(next)
      setError(null) // lần đầu lỗi, lần kiểm lại tải được → bỏ màn lỗi
      setPower(null)
      try {
        const p = await loadPower(next)
        // Power của bản cũ về muộn sau khi đã chuyển sang bản mới thì bỏ.
        if (alive && shownKey.current === key) setPower(p)
      } catch {
        // Thiếu power chỉ mất số cổng/kW — bản đồ vẫn dùng được, không báo lỗi to.
      }
    }

    loadStations()
      .then((idx) => {
        lastCheck.current = Date.now()
        return apply(idx)
      })
      .catch((e) => alive && setError(String(e)))

    async function recheck() {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastCheck.current < RECHECK_MS) return
      lastCheck.current = Date.now()
      if (loading.current) return
      loading.current = true
      try {
        const m = await loadManifest()
        if (dataKey(m) !== shownKey.current) await apply(await loadStations(m))
      } catch {
        // Mạng chập chờn: giữ dữ liệu đang có, lần sau hỏi lại.
      } finally {
        loading.current = false
      }
    }

    document.addEventListener('visibilitychange', recheck)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [])

  return { index, power, error }
}
