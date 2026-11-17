import { useMemo, useState } from 'react'
import { Search, Settings2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { Station } from '../data/types'
import { searchStations, type StationIndex } from '../data/stations'
import { pick } from '../i18n'

const L = pick({
  vi: { placeholder: 'Tìm trạm theo tên hoặc địa chỉ…', clear: 'Xoá', settings: 'Cài đặt' },
  en: { placeholder: 'Search stations by name or address…', clear: 'Clear', settings: 'Settings' },
})

interface Props {
  index: StationIndex
  onPick: (st: Station) => void
  /** Nút ⚙ ở cuối ô tìm kiếm. */
  onSettings: () => void
}

export function SearchBar({ index, onPick, onSettings }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    if (q.trim().length < 2) return []
    return searchStations(index, q, 20)
  }, [q, index])

  return (
    <div className="relative w-full max-w-lg">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        placeholder={L.placeholder}
        className={`h-12 bg-card pl-9 text-[15px] shadow-lg shadow-black/5 ring-1 ring-black/5 ${q ? 'pr-20' : 'pr-12'}`}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {/* Cuối ô: nút xoá (khi đang gõ) rồi nút ⚙ Cài đặt. */}
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5">
        {q && (
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label={L.clear}
            onClick={() => {
              setQ('')
              setOpen(false)
            }}
          >
            <X className="size-4" />
          </button>
        )}
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={L.settings}
          title={L.settings}
          onClick={onSettings}
        >
          <Settings2 className="size-5" />
        </button>
      </div>
      {open && results.length > 0 && (
        <ul className="absolute top-14 right-0 left-0 max-h-[50dvh] overflow-y-auto rounded-2xl bg-popover p-1.5 shadow-xl shadow-black/10 ring-1 ring-black/5">
          {results.map((st) => (
            <li
              key={st.entityId}
              className="flex cursor-pointer flex-col gap-0.5 rounded-xl px-3 py-2.5 hover:bg-muted"
              onClick={() => {
                onPick(st)
                setOpen(false)
                setQ(st.name)
              }}
            >
              <span className="text-sm font-semibold text-foreground">{st.name}</span>
              <span className="truncate text-xs text-muted-foreground">{st.address}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
