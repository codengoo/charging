import { useEffect, useMemo, useRef, useState } from 'react'
import { History, Loader2, MapPin, Mic, ScanQrCode, Search, Settings2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { Station } from '../data/types'
import { searchStations, type StationIndex } from '../data/stations'
import { searchAddress, type PlaceHit } from '../data/trip'
import type { GeoPoint } from '../lib/geo'
import { speechSupported, useSpeech } from '../lib/speech'
import { pick } from '../i18n'

const L = pick({
  vi: {
    placeholder: 'Tìm trạm hoặc địa chỉ…',
    clear: 'Xoá',
    settings: 'Cài đặt',
    scan: 'Quét mã QR trạm',
    stations: 'Trạm sạc',
    places: 'Địa điểm',
    recent: 'Vừa xem',
    clearRecent: 'Xoá lịch sử',
    voice: 'Tìm bằng giọng nói',
    voiceStop: 'Dừng nghe',
    listening: 'Đang nghe…',
    denied: 'Chưa cho phép dùng micro',
    failed: 'Không nhận được giọng nói, thử lại',
  },
  en: {
    placeholder: 'Search stations or places…',
    clear: 'Clear',
    settings: 'Settings',
    scan: 'Scan station QR code',
    stations: 'Stations',
    places: 'Places',
    recent: 'Recently viewed',
    clearRecent: 'Clear history',
    voice: 'Search by voice',
    voiceStop: 'Stop listening',
    listening: 'Listening…',
    denied: 'Microphone access not allowed',
    failed: "Didn't catch that, try again",
  },
})

/** Gõ tới chừng này ký tự mới hỏi địa chỉ (HERE) — và chờ ngừng gõ chừng này ms. */
const PLACE_MIN_CHARS = 3
const PLACE_DEBOUNCE_MS = 400
/** Có cả kết quả địa chỉ thì chỉ hiện chừng này trạm, để mục Địa điểm không bị đẩy khuất. */
const STATIONS_WITH_PLACES = 8

interface Props {
  index: StationIndex
  onPick: (st: Station) => void
  /** Chọn một địa chỉ (HERE) → App bay tới và mở trạm gần đó. */
  onPickPlace: (hit: PlaceHit) => void
  /** Vị trí ưu tiên kết quả địa chỉ gần đó (GPS / tâm bản đồ). */
  near: () => GeoPoint | null
  /** Trạm vừa xem, mới nhất trước — hiện khi ô còn trống. */
  recent: Station[]
  onClearRecent: () => void
  /** Nút ⚙ ở cuối ô tìm kiếm. */
  onSettings: () => void
  /** Nút quét QR mở trạm, cạnh ⚙. */
  onScan: () => void
}

export function SearchBar({ index, onPick, onPickPlace, near, recent, onClearRecent, onSettings, onScan }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [places, setPlaces] = useState<{ q: string; hits: PlaceHit[] } | null>(null)
  const [placesLoading, setPlacesLoading] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const nearRef = useRef(near)
  nearRef.current = near
  // Giọng nói: chữ hiện dần vào ô trong lúc nói, danh sách kết quả mở như khi gõ.
  const speech = useSpeech((text) => {
    setQ(text)
    setOpen(true)
  })
  const { error: speechError, clearError: clearSpeechError } = speech
  useEffect(() => {
    if (!speechError) return
    const t = setTimeout(clearSpeechError, 4000)
    return () => clearTimeout(t)
  }, [speechError, clearSpeechError])
  const placeholder = speech.listening
    ? L.listening
    : speechError === 'denied'
      ? L.denied
      : speechError === 'failed'
        ? L.failed
        : L.placeholder
  // Chừa chỗ bên phải cho các nút: xoá (khi có chữ), micro (nếu trình duyệt hỗ trợ), QR, ⚙.
  const padRight = ['pr-20', 'pr-28', 'pr-36'][Number(Boolean(q)) + Number(speechSupported)]

  // Bấm ra ngoài (bản đồ, chip…) hoặc Escape thì đóng danh sách — trước đây chỉ đóng khi chọn/xoá.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const results = useMemo(() => {
    if (q.trim().length < 2) return []
    return searchStations(index, q, 20)
  }, [q, index])

  // Địa chỉ: chờ ngừng gõ rồi mới hỏi HERE (giới hạn tần suất API); gõ tiếp thì huỷ lượt cũ.
  const term = q.trim()
  useEffect(() => {
    if (term.length < PLACE_MIN_CHARS) {
      setPlaces(null)
      setPlacesLoading(false)
      return
    }
    const ctrl = new AbortController()
    setPlacesLoading(true)
    const t = setTimeout(() => {
      searchAddress(term, nearRef.current(), ctrl.signal)
        .then((hits) => setPlaces({ q: term, hits }))
        .catch(() => setPlaces({ q: term, hits: [] })) // mất mạng / lỗi: chỉ còn kết quả trạm
        .finally(() => !ctrl.signal.aborted && setPlacesLoading(false))
    }, PLACE_DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [term])

  const placeHits = places && places.q === term ? places.hits : []
  const stations = placeHits.length ? results.slice(0, STATIONS_WITH_PLACES) : results
  const showRecent = term.length === 0 && recent.length > 0
  const hasList = showRecent || stations.length > 0 || placeHits.length > 0

  const stationItem = (st: Station, recentIcon = false) => (
    <li key={st.entityId} role="option" aria-selected={false}>
      <button
        type="button"
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
        onClick={() => {
          onPick(st)
          setOpen(false)
          setQ(st.name)
        }}
      >
        {recentIcon && <History className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{st.name}</span>
          <span className="w-full truncate text-xs text-muted-foreground">{st.address}</span>
        </span>
      </button>
    </li>
  )

  return (
    <div ref={box} className="relative w-full max-w-lg">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        placeholder={placeholder}
        className={`h-12 bg-card pl-9 text-[15px] shadow-lg shadow-black/5 ring-1 ring-black/5 ${padRight} ${speechError ? 'placeholder:text-destructive' : ''}`}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          clearSpeechError()
        }}
        onFocus={() => setOpen(true)}
        // Escape đóng mà ô vẫn giữ focus — bấm lại vào ô thì mở lại.
        onClick={() => setOpen(true)}
        role="combobox"
        aria-expanded={open && hasList}
        aria-controls="search-results"
        aria-autocomplete="list"
      />
      {/* Cuối ô: nút xoá (khi đang gõ), nút quét QR rồi nút ⚙ Cài đặt. */}
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
        {speechSupported && (
          <button
            type="button"
            className={`flex size-9 items-center justify-center rounded-full ${
              speech.listening ? 'animate-pulse bg-brand text-brand-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            aria-label={speech.listening ? L.voiceStop : L.voice}
            aria-pressed={speech.listening}
            title={speech.listening ? L.voiceStop : L.voice}
            onClick={() => {
              if (!speech.listening) setQ('')
              speech.toggle()
            }}
          >
            <Mic className="size-5" />
          </button>
        )}
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={L.scan}
          title={L.scan}
          onClick={onScan}
        >
          <ScanQrCode className="size-5" />
        </button>
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
      {open && hasList && (
        <div
          id="search-results"
          className="absolute top-14 right-0 left-0 max-h-[50dvh] overflow-y-auto rounded-2xl bg-popover p-1.5 shadow-xl shadow-black/10 ring-1 ring-black/5"
        >
          {showRecent && (
            <>
              <div className="flex items-center justify-between px-3 pt-1.5 pb-1">
                <span className="text-xs font-semibold text-muted-foreground">{L.recent}</span>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={onClearRecent}>
                  {L.clearRecent}
                </button>
              </div>
              <ul role="listbox" aria-label={L.recent}>
                {recent.map((st) => stationItem(st, true))}
              </ul>
            </>
          )}
          {stations.length > 0 && (
            <>
              {placeHits.length > 0 && <SectionTitle>{L.stations}</SectionTitle>}
              <ul role="listbox" aria-label={L.stations}>
                {stations.map((st) => stationItem(st))}
              </ul>
            </>
          )}
          {(placeHits.length > 0 || (placesLoading && term.length >= PLACE_MIN_CHARS && stations.length > 0)) && (
            <SectionTitle>
              {L.places}
              {placesLoading && <Loader2 className="ml-1.5 inline size-3 animate-spin align-[-1px]" aria-hidden />}
            </SectionTitle>
          )}
          {placeHits.length > 0 && (
            <ul role="listbox" aria-label={L.places}>
              {placeHits.map((h) => (
                <li key={`${h.lat},${h.lng}`} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    onClick={() => {
                      onPickPlace(h)
                      setOpen(false)
                      setQ(h.label)
                    }}
                  >
                    <MapPin className="size-4 shrink-0 text-brand" aria-hidden />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-semibold text-foreground">{h.label}</span>
                      {h.address && <span className="w-full truncate text-xs text-muted-foreground">{h.address}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground">{children}</div>
}
