/**
 * Trạm vừa xem (mới nhất trước), lưu trên máy — hiện khi bấm vào ô tìm kiếm còn trống.
 * Chỉ giữ id; trạm không còn trong dữ liệu ngày thì bỏ qua lúc hiện.
 */
import { useCallback, useState } from 'react'
import { readJson, writeJson } from '../lib/storage'

const KEY = 'tramsac.recent'
export const RECENT_MAX = 10

/** Đọc mảng id; hỏng / sai kiểu → rỗng. */
export function parseRecent(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, RECENT_MAX)
}

/** Đưa `id` lên đầu, bỏ bản trùng, cắt còn RECENT_MAX. */
export function pushRecent(ids: string[], id: string): string[] {
  return [id, ...ids.filter((x) => x !== id)].slice(0, RECENT_MAX)
}

export function useRecent() {
  const [ids, setIds] = useState<string[]>(() => parseRecent(readJson(KEY)))
  const push = useCallback((id: string) => {
    setIds((cur) => {
      if (cur[0] === id) return cur
      const next = pushRecent(cur, id)
      writeJson(KEY, next) // chế độ riêng tư không ghi được thì chỉ nhớ trong phiên
      return next
    })
  }, [])
  const clear = useCallback(() => {
    setIds([])
    writeJson(KEY, [])
  }, [])
  return { ids, push, clear }
}
