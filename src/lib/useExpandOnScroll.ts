import { useCallback, useRef, useState, type TouchEvent, type UIEvent, type WheelEvent } from 'react'

/** Chiều cao tối đa của drawer điện thoại: lúc mở và khi đã nâng (sát dưới status bar). */
export const SHEET_COMPACT = '60dvh'
export const SHEET_EXPANDED = 'calc(100dvh - env(safe-area-inset-top) - 8px)'
export const SHEET_TRANSITION = 'max-height 300ms ease-out'

/** Cuộn quá chừng này thì nâng drawer. */
const EXPAND_AT = 8
/** Nội dung không cuộn được nữa: kéo xuống tại top chừng này thì thu. */
const PULL_DOWN = 24

const scrollable = (el: HTMLElement) => el.scrollHeight - el.clientHeight > 1

/**
 * Drawer nâng lên khi người dùng cuộn nội dung, thu về khi cuộn ngược lên tới top. Gắn `bind` vào
 * khung cuộn, đổi max-height của drawer theo `expanded`.
 *
 * Bẫy cần tránh: nâng lên làm khung cao hơn, nội dung vừa khít thì scrollTop bị kẹp về 0 — coi đó
 * là "chạm top" thì drawer thu rồi lại nâng liên tục. Nên chỉ thu khi (a) người dùng thật sự cuộn
 * ngược tới 0 mà nội dung vẫn còn cuộn được, hoặc (b) nội dung không cuộn được nữa và người dùng
 * kéo xuống / lăn chuột lên tại top.
 */
export function useExpandOnScroll() {
  const [expanded, setExpanded] = useState(false)
  const lastTop = useRef(0)
  const touchY = useRef<number | null>(null)

  const onScroll = useCallback((e: UIEvent<HTMLElement>) => {
    const el = e.currentTarget
    const top = el.scrollTop
    if (top > EXPAND_AT) setExpanded(true)
    else if (top <= 0 && lastTop.current > 0 && scrollable(el)) setExpanded(false)
    lastTop.current = top
  }, [])

  const onTouchStart = useCallback((e: TouchEvent<HTMLElement>) => {
    touchY.current = e.touches[0]?.clientY ?? null
  }, [])

  const onTouchMove = useCallback((e: TouchEvent<HTMLElement>) => {
    const el = e.currentTarget
    const y = e.touches[0]?.clientY
    if (touchY.current === null || y === undefined || el.scrollTop > 0 || scrollable(el)) return
    if (y - touchY.current >= PULL_DOWN) setExpanded(false)
  }, [])

  const onWheel = useCallback((e: WheelEvent<HTMLElement>) => {
    const el = e.currentTarget
    if (e.deltaY < 0 && el.scrollTop <= 0 && !scrollable(el)) setExpanded(false)
  }, [])

  return { expanded, bind: { onScroll, onTouchStart, onTouchMove, onWheel } }
}
