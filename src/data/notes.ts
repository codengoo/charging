/**
 * Ghi chú cá nhân cho từng trạm ("cổng 2 hay lỗi", "đỗ tầng B2"…). Chỉ nằm trong localStorage
 * của máy — không gửi lên server; chuyển máy bằng sao lưu (backup.ts mang theo `notes`).
 */
import { useCallback, useState } from 'react'

export interface Note {
  text: string
  /** Lần sửa cuối (epoch ms) — gộp sao lưu giữ bản mới hơn. */
  at: number
}

export type NoteMap = Record<string, Note>

export const NOTES_KEY = 'tramsac.notes'
export const NOTE_MAX = 1000

/** Đọc từ JSON lạ (localStorage, file sao lưu): bỏ mục sai kiểu, cắt chữ quá dài. */
export function parseNotes(o: unknown): NoteMap {
  const out: NoteMap = {}
  if (!o || typeof o !== 'object' || Array.isArray(o)) return out
  for (const [id, n] of Object.entries(o as Record<string, unknown>)) {
    if (!n || typeof n !== 'object') continue
    const { text, at } = n as Partial<Note>
    if (typeof text !== 'string' || !text.trim() || typeof at !== 'number') continue
    out[id] = { text: text.slice(0, NOTE_MAX), at }
  }
  return out
}

/** Gộp: trạm chỉ có ở một bên thì lấy; có ở cả hai thì giữ bản sửa sau. */
export function mergeNotes(mine: NoteMap, incoming: NoteMap): NoteMap {
  const out = { ...mine }
  for (const [id, n] of Object.entries(incoming)) if (!out[id] || out[id].at < n.at) out[id] = n
  return out
}

/** Số ghi chú sẽ thêm / thay khi gộp — cho câu xác nhận nhập. */
export function newNotesCount(mine: NoteMap, incoming: NoteMap): number {
  return Object.entries(incoming).filter(([id, n]) => !mine[id] || mine[id].at < n.at).length
}

function load(): NoteMap {
  try {
    return parseNotes(JSON.parse(localStorage.getItem(NOTES_KEY) ?? 'null'))
  } catch {
    return {}
  }
}

function save(notes: NoteMap) {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  } catch {
    // chế độ riêng tư / đầy bộ nhớ: vẫn dùng trong phiên
  }
}

export function useNotes() {
  const [notes, setNotes] = useState<NoteMap>(load)

  const update = useCallback((fn: (n: NoteMap) => NoteMap) => {
    setNotes((cur) => {
      const next = fn(cur)
      save(next)
      return next
    })
  }, [])

  /** Chữ rỗng (sau khi bỏ khoảng trắng) = xoá ghi chú. */
  const set = useCallback(
    (entityId: string, text: string) =>
      update((cur) => {
        const next = { ...cur }
        const t = text.trim().slice(0, NOTE_MAX)
        if (t) next[entityId] = { text: t, at: Date.now() }
        else delete next[entityId]
        return next
      }),
    [update],
  )

  const merge = useCallback((incoming: NoteMap) => update((cur) => mergeNotes(cur, incoming)), [update])

  return { notes, set, merge }
}
