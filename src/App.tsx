import { useEffect, useRef, useState } from 'react'
import { List } from 'lucide-react'
import { MapView } from './map/MapView'
import { SearchBar } from './ui/SearchBar'
import { StationSheet } from './ui/StationSheet'
import { GroupsSheet } from './ui/GroupsSheet'
import { SavedSheet } from './ui/SavedSheet'
import { ShareSheet } from './ui/ShareSheet'
import { ChangelogModal } from './ui/ChangelogModal'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { useStationData } from './data/useStationData'
import { useStationDetail } from './data/useStationDetail'
import { allSaved } from './data/groups'
import { useGroupBook } from './data/useGroupBook'
import { APP_VERSION } from './data/changelog'
import type { Station } from './data/types'
import { parseStationId, stationPath } from './lib/stationUrl'

const DEFAULT_TITLE = document.title

interface Filters {
  favoritesOnly: boolean
  activeOnly: boolean
}

export function App() {
  const { index, power, error } = useStationData()
  const [selected, setSelected] = useState<Station | null>(null)
  // Trạm cuối cùng từng mở — bảng trạm vẫn có nội dung trong lúc trôi xuống sau khi đóng.
  const [sheetStation, setSheetStation] = useState<Station | null>(null)
  if (selected && selected !== sheetStation) setSheetStation(selected)
  // Chi tiết VinFast chỉ gọi khi có trạm được chọn; giữ theo sheetStation để còn ảnh lúc trôi xuống.
  const detail = useStationDetail(sheetStation?.entityId ?? null)
  const [grouping, setGrouping] = useState(false)
  const [sharing, setSharing] = useState(false)
  // Đọc NGAY lúc khởi tạo: effect đồng bộ URL bên dưới sẽ ghi đè pathname.
  const [linkedId] = useState(() => parseStationId(location.pathname))
  const [showSaved, setShowSaved] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; zoom?: number } | null>(null)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const groups = useGroupBook()
  const { book } = groups
  const savedCount = allSaved(book).size
  const [filters, setFilters] = useState<Filters>({
    favoritesOnly: false,
    activeOnly: false,
  })

  // Mở từ link chia sẻ /tram/<id>-<slug>: chọn trạm và bay tới ngay khi có dữ liệu (một lần).
  const linkHandled = useRef(false)
  useEffect(() => {
    if (!index || linkHandled.current) return
    linkHandled.current = true
    const st = linkedId ? index.byId.get(linkedId) : undefined
    if (st) pick(st)
  }, [index, linkedId])

  // Generation mới (dữ liệu làm mới hằng ngày): trạm đang mở trỏ sang bản ghi mới cùng id.
  useEffect(() => {
    if (!index) return
    setSelected((s) => (s ? (index.byId.get(s.entityId) ?? s) : s))
  }, [index])

  // URL theo trạm đang mở: copy thanh địa chỉ là ra đúng link chia sẻ. replaceState chứ không
  // pushState — bấm qua lại nhiều trạm không làm đầy lịch sử nút Back.
  useEffect(() => {
    // Chưa tải xong dữ liệu thì chưa biết trạm trong link có tồn tại không — đừng đụng URL.
    if (!index) return
    const path = selected ? stationPath(selected) : '/'
    if (location.pathname !== path) history.replaceState(null, '', path + location.search)
    document.title = selected ? `${selected.name} — Trạm sạc VinFast` : DEFAULT_TITLE
  }, [index, selected])

  function pick(st: Station) {
    setSelected(st)
    setFlyTo({ lng: st.lng, lat: st.lat, zoom: 15 })
  }

  if (error) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
        <p>Không tải được dữ liệu trạm.</p>
        <code className="text-xs">{error}</code>
      </div>
    )
  }
  if (!index) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center text-muted-foreground">
        <div className="size-9 animate-spin rounded-full border-[3px] border-muted border-t-brand" />
        <p>Đang tải bản đồ trạm sạc…</p>
      </div>
    )
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <MapView
        index={index}
        filters={filters}
        book={book}
        selected={selected}
        flyTo={flyTo}
        onSelect={pick}
        onLocate={setUserPos}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex flex-col gap-2 p-3">
        <div className="pointer-events-auto">
          <SearchBar index={index} onPick={pick} />
        </div>
        <div className="pointer-events-auto flex flex-wrap gap-2">
          <FilterChip
            label={`Đã lưu${savedCount ? ` (${savedCount})` : ''}`}
            on={filters.favoritesOnly}
            onClick={() => setFilters((f) => ({ ...f, favoritesOnly: !f.favoritesOnly }))}
          />
          <FilterChip
            label="Đang hoạt động"
            on={filters.activeOnly}
            onClick={() => setFilters((f) => ({ ...f, activeOnly: !f.activeOnly }))}
          />
          <Chip variant="floating" onClick={() => setShowSaved(true)}>
            <List />
            Danh sách
          </Chip>
        </div>
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="absolute bottom-3 left-3 z-[5] rounded-full bg-card/90 shadow-lg shadow-black/10 backdrop-blur"
        onClick={() => setShowChangelog(true)}
      >
        v{APP_VERSION} · Có gì mới
      </Button>

      {/* Các bảng luôn GẮN sẵn, chỉ đổi `open`: gỡ hẳn khi đóng thì vaul/Radix không kịp chạy
          hiệu ứng trôi xuống. Bảng trạm giữ trạm cuối cùng để còn nội dung lúc đang trôi. */}
      {sheetStation && (
        <StationSheet
          open={selected !== null}
          station={sheetStation}
          book={book}
          power={power?.get(sheetStation.entityId)}
          powerLoading={power === null}
          detail={detail.detail}
          detailLoading={detail.loading}
          onOpenGroups={() => setGrouping(true)}
          onShare={() => setSharing(true)}
          onClose={() => {
            setSelected(null)
            setGrouping(false)
            setSharing(false)
          }}
        >
          <ShareSheet open={sharing} station={sheetStation} onClose={() => setSharing(false)} />
          <GroupsSheet
            open={grouping}
            book={book}
            now={groups.now}
            entityId={sheetStation.entityId}
            stationName={sheetStation.name}
            onToggle={(g) => groups.toggle(g, sheetStation.entityId)}
            onCreate={(g) => groups.create(g, sheetStation.entityId)}
            onDelete={groups.remove}
            onTtlChange={groups.setTtl}
            onClose={() => setGrouping(false)}
          />
        </StationSheet>
      )}

      <SavedSheet
        open={showSaved}
        index={index}
        book={book}
        now={groups.now}
        userPos={userPos}
        onPick={(st) => {
          setShowSaved(false)
          pick(st)
        }}
        onUnsave={groups.removeFromAll}
        onClose={() => setShowSaved(false)}
      />

      <ChangelogModal open={showChangelog} onClose={() => setShowChangelog(false)} />
    </div>
  )
}

function FilterChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <Chip variant="floating" selected={on} className={on ? 'shadow-md shadow-black/10' : ''} onClick={onClick}>
      {label}
    </Chip>
  )
}
