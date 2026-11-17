import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { pick } from '../i18n'

const L = pick({ vi: { remove: 'Xoá' }, en: { remove: 'Delete' } })

/** Vuốt quá chừng này (px) rồi thả → dừng lại, lộ nút "Xoá". */
const REVEAL = 84
/** Vuốt quá chừng này (tỉ lệ bề ngang hàng) rồi thả → xoá luôn. */
const COMMIT_RATIO = 0.5
/** Bề rộng góc bo của hàng (rounded-xl) — nền đỏ chui vào dưới phần này. */
const UNDER_RADIUS = 16
/** Ngón tay đi chừng này mới quyết định là vuốt ngang (không phải cuộn dọc). */
const SLOP = 8

/**
 * Hàng vuốt phải → trái để xoá (như danh sách iOS): hàng trượt theo ngón tay, lộ nền đỏ "Xoá" phía
 * sau. Thả: quá nửa hàng → xoá; quá REVEAL → dừng lại lộ nút "Xoá"; ít hơn → trượt về. Vuốt dọc vẫn
 * cuộn bình thường (`touch-action: pan-y`); `data-vaul-no-drag` để drawer không bắt cú vuốt.
 */
export function SwipeToDelete({ onDelete, children }: { onDelete: () => void; children: ReactNode }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [gone, setGone] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number; base: number; horizontal: boolean | null } | null>(null)
  /** Vừa vuốt xong — chặn cú click sinh ra từ chính cú vuốt. */
  const swiped = useRef(false)

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    start.current = { x: e.clientX, y: e.clientY, base: dx, horizontal: null }
    swiped.current = false
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const s = start.current
    if (!s) return
    const mx = e.clientX - s.x
    const my = e.clientY - s.y
    if (s.horizontal === null) {
      if (Math.abs(mx) < SLOP && Math.abs(my) < SLOP) return
      s.horizontal = Math.abs(mx) > Math.abs(my)
      if (!s.horizontal) return (start.current = null)
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(true)
    }
    swiped.current = true
    const w = box.current?.offsetWidth ?? 320
    setDx(Math.max(-w, Math.min(0, s.base + mx)))
  }

  function onUp() {
    const s = start.current
    start.current = null
    if (!s?.horizontal) return
    setDragging(false)
    const w = box.current?.offsetWidth ?? 320
    if (-dx > w * COMMIT_RATIO) remove()
    else setDx(-dx > REVEAL ? -REVEAL : 0)
  }

  function remove() {
    const w = box.current?.offsetWidth ?? 320
    setDx(-w)
    setGone(true)
    // Đợi hàng trượt hết + thu chiều cao rồi mới xoá khỏi dữ liệu.
    setTimeout(onDelete, 220)
  }

  return (
    <div
      ref={box}
      data-vaul-no-drag
      className="relative overflow-hidden rounded-xl transition-[max-height,opacity] duration-200"
      style={gone ? { maxHeight: 0, opacity: 0 } : { maxHeight: 120 }}
    >
      {/* Nền đỏ phía sau: bấm khi đang lộ nút cũng xoá. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden={dx === 0}
        onClick={remove}
        className="absolute inset-y-0 right-0 flex items-center justify-end gap-1.5 bg-destructive pr-5 text-sm font-semibold text-white"
        // Chỉ hiện khi đang vuốt / đang mở — để sẵn thì lộ viền đỏ ở góc bo của hàng.
        // + UNDER_RADIUS: lan vào dưới góc bo của hàng đang trượt — không hở khe nền giữa góc bo và vùng đỏ.
        style={{ width: dx < 0 ? Math.max(REVEAL, -dx) + UNDER_RADIUS : 0, visibility: dx < 0 ? 'visible' : 'hidden' }}
      >
        <Trash2 className="size-4" aria-hidden />
        {L.remove}
      </button>
      <div
        className="relative touch-pan-y"
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClickCapture={(e) => {
          // Cú click ngay sau một cú vuốt, hoặc khi hàng đang mở → chỉ đóng hàng, không mở bên trong.
          if (swiped.current || dx !== 0) {
            e.stopPropagation()
            e.preventDefault()
            swiped.current = false
            if (dx !== 0 && !dragging) setDx(0)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
