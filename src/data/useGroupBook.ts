import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  STORAGE_KEY,
  alive,
  createGroup,
  deleteGroup,
  loadBook,
  parseBook,
  pruneExpired,
  removeFromAll,
  saveBook,
  setGroupTtl,
  toggleMembership,
  type GroupBook,
  type StationGroup,
} from './groups'
import { mergeBooks } from './backup'

/** Nhịp dọn bản ghi quá hạn và cập nhật đồng hồ đếm ngược trên màn hình. */
const TICK_MS = 60_000

/**
 * Sổ nhóm trong React state, ghi xuống localStorage mỗi lần đổi.
 *
 * `book` trả ra đã lọc trạm hết hạn theo giờ hiện tại, nên màn hình không bao giờ
 * hiện dấu đã quá hạn dù kho chưa kịp dọn.
 */
export function useGroupBook() {
  const [stored, setStored] = useState<GroupBook>(() => loadBook())
  const [now, setNow] = useState(() => Date.now())

  // Updater phải THUẦN (StrictMode gọi nó hai lần): thời điểm tính sẵn ở ngoài, ghi kho để
  // effect bên dưới lo.
  const update = useCallback((fn: (b: GroupBook) => GroupBook) => setStored(fn), [])

  useEffect(() => saveBook(stored), [stored])

  // Nhịp đồng hồ + dọn kho. Chỉ ghi khi thật sự có bản ghi để xoá.
  useEffect(() => {
    const tick = () => {
      const t = Date.now()
      setNow(t)
      update((b) => pruneExpired(b, t) ?? b)
    }
    tick()
    const h = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(h)
  }, [update])

  // Tab khác đổi sổ nhóm thì đọc lại, không thì hai tab ghi đè lẫn nhau.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setStored(parseBook(e.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const book = useMemo(() => alive(stored, now), [stored, now])

  const actions = useMemo(
    () => ({
      toggle: (groupId: string, entityId: string) => {
        const t = Date.now()
        update((b) => toggleMembership(b, groupId, entityId, t))
      },
      removeFromAll: (entityId: string) => update((b) => removeFromAll(b, entityId)),
      /** Tạo nhóm; truyền `entityId` thì xếp luôn trạm đó vào nhóm mới. */
      create: (g: Omit<StationGroup, 'id' | 'builtIn'>, entityId?: string) => {
        const t = Date.now()
        update((b) => {
          const { book: next, id } = createGroup(b, g, t)
          return entityId ? toggleMembership(next, id, entityId, t) : next
        })
      },
      remove: (groupId: string) => update((b) => deleteGroup(b, groupId)),
      setTtl: (groupId: string, hours: number) => update((b) => setGroupTtl(b, groupId, hours)),
      /** Gộp sổ nhóm nhập từ link / file sao lưu (không xoá gì). */
      merge: (incoming: GroupBook) => update((b) => mergeBooks(b, incoming)),
    }),
    [update],
  )

  return { book, now, ...actions }
}
