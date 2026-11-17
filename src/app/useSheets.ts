import { useCallback, useMemo, useState } from 'react'

/** Các bảng / hộp thoại App giữ cờ mở (bảng trạm mở theo `selected`, không nằm ở đây). */
export type SheetName = 'groups' | 'share' | 'car' | 'saved' | 'backup' | 'import' | 'nearby' | 'settings' | 'changelog' | 'scan'

/**
 * Bảng con mở chồng trong cây hộp thoại của bảng cha: đóng cha thì đóng luôn con, không thì con
 * còn treo lại khi mở cha lần sau. Bảng trạm (cha của groups/share/car) đóng qua `closeStationChildren`.
 */
const CHILDREN: Partial<Record<SheetName, SheetName[]>> = {
  saved: ['backup'],
}

const STATION_CHILDREN: SheetName[] = ['groups', 'share', 'car']

/** Cờ mở của mọi bảng trong một state; `open` / `close` có luật đóng bảng con. */
export function useSheets() {
  const [shown, setShown] = useState<ReadonlySet<SheetName>>(() => new Set())

  const update = useCallback((fn: (s: Set<SheetName>) => void) => {
    setShown((prev) => {
      const next = new Set(prev)
      fn(next)
      return next
    })
  }, [])

  return useMemo(
    () => ({
      is: (name: SheetName) => shown.has(name),
      open: (name: SheetName) => update((s) => void s.add(name)),
      close: (...names: SheetName[]) =>
        update((s) => {
          for (const n of names) {
            s.delete(n)
            for (const c of CHILDREN[n] ?? []) s.delete(c)
          }
        }),
      closeStationChildren: () => update((s) => STATION_CHILDREN.forEach((c) => s.delete(c))),
    }),
    [shown, update],
  )
}
