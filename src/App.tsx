import { useEffect, useRef, useState } from 'react'
import { List, LocateFixed } from 'lucide-react'
import { MapView } from './map/MapView'
import { SearchBar } from './ui/SearchBar'
import { StationSheet } from './ui/StationSheet'
import { GroupsSheet } from './ui/GroupsSheet'
import { SavedSheet } from './ui/SavedSheet'
import { ShareSheet } from './ui/ShareSheet'
import { ChangelogModal } from './ui/ChangelogModal'
import { PowerLegend } from './ui/PowerLegend'
import { NearbySheet } from './ui/NearbySheet'
import { BackupSheet } from './ui/BackupSheet'
import { ImportDialog, pendingImport, type PendingImport } from './ui/ImportDialog'
import { IMPORT_HASH, decodeBackup } from './data/backup'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { useStationData } from './data/useStationData'
import { useStationDetail } from './data/useStationDetail'
import { DEFAULT_FILTERS, FAST_KW, type Filters } from './data/stations'
import { allSaved } from './data/groups'
import { useGroupBook } from './data/useGroupBook'
import { APP_VERSION } from './data/changelog'
import type { Station } from './data/types'
import { parseStationId, stationPath } from './lib/stationUrl'

const DEFAULT_TITLE = document.title

function readImportHash(): string | null {
  return location.hash.startsWith(IMPORT_HASH) ? location.hash.slice(IMPORT_HASH.length) : null
}

/** Lần mở bảng "Gần tôi": điểm gốc chụp lúc bấm, kèm nguồn (GPS hay tâm bản đồ). */
interface Nearby {
  origin: { lat: number; lng: number }
  fromGps: boolean
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
  // Tâm bản đồ hiện tại (ref: đổi liên tục khi kéo, không cần render lại). Mặc định = tâm mặc định của map.
  const mapCenter = useRef({ lat: 16.05, lng: 108.2 })
  const [showNearby, setShowNearby] = useState(false)
  // Giữ lần mở cuối để bảng còn nội dung lúc trôi xuống (giống sheetStation).
  const [nearby, setNearby] = useState<Nearby | null>(null)
  const groups = useGroupBook()
  const { book } = groups
  const [showBackup, setShowBackup] = useState(false)
  // Link sao lưu `/#import=<payload>`: đọc NGAY lúc khởi tạo, effect đồng bộ URL sẽ xoá hash.
  const [importHash] = useState(readImportHash)
  const [showImport, setShowImport] = useState(false)
  // Giữ lần nhập cuối để hộp xác nhận còn nội dung lúc trôi xuống.
  const [pending, setPending] = useState<PendingImport | null>(null)
  function askImport(incoming: Parameters<typeof pendingImport>[1]) {
    setPending(pendingImport(book, incoming))
    setShowImport(true)
  }
  const savedCount = allSaved(book).size
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  // Hai mức công suất loại trừ nhau; bấm lại chip đang bật thì về tất cả.
  const setPower = (p: Filters['power']) => setFilters((f) => ({ ...f, power: f.power === p ? 'all' : p }))

  // Mở từ link chia sẻ /tram/<id>-<slug>: chọn trạm và bay tới ngay khi có dữ liệu (một lần).
  const linkHandled = useRef(false)
  useEffect(() => {
    if (!index || linkHandled.current) return
    linkHandled.current = true
    const st = linkedId ? index.byId.get(linkedId) : undefined
    if (st) pick(st)
  }, [index, linkedId])

  // Mở bằng link sao lưu: bỏ hash ngay (nhập hay huỷ cũng không để lại), rồi hỏi xác nhận.
  // Dán link vào tab ĐANG mở app chỉ đổi hash, không tải lại trang → nghe thêm hashchange.
  const askImportRef = useRef(askImport)
  askImportRef.current = askImport
  useEffect(() => {
    const handle = (payload: string | null) => {
      if (!payload) return
      history.replaceState(null, '', location.pathname + location.search)
      void decodeBackup(payload).then((b) => askImportRef.current(b))
    }
    handle(importHash)
    const onHash = () => handle(readImportHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [importHash])

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
        power={power}
        selected={selected}
        flyTo={flyTo}
        onSelect={pick}
        onLocate={setUserPos}
        onMoveEnd={(c) => (mapCenter.current = c)}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex flex-col gap-2 p-3">
        <div className="pointer-events-auto">
          <SearchBar index={index} onPick={pick} />
        </div>
        {/* Một hàng vuốt ngang: nhiều chip quá thì không xuống dòng che bản đồ. py/-my chừa chỗ
            cho bóng chip khỏi bị overflow cắt. */}
        <div className="pointer-events-auto -mx-3 -my-2 flex gap-2 overflow-x-auto px-3 py-2 no-scrollbar">
          <Chip
            variant="floating"
            onClick={() => {
              setNearby(userPos ? { origin: userPos, fromGps: true } : { origin: mapCenter.current, fromGps: false })
              setShowNearby(true)
            }}
          >
            <LocateFixed />
            Gần tôi
          </Chip>
          <FilterChip
            label={`Đã lưu${savedCount ? ` (${savedCount})` : ''}`}
            on={filters.favoritesOnly}
            onClick={() => setFilters((f) => ({ ...f, favoritesOnly: !f.favoritesOnly }))}
          />
          <FilterChip label="Sạc nhanh DC" on={filters.power === 'dc'} onClick={() => setPower('dc')} />
          <FilterChip label={`≥ ${FAST_KW} kW`} on={filters.power === 'dc120'} onClick={() => setPower('dc120')} />
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

      <PowerLegend />

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
        onBackup={() => setShowBackup(true)}
        onClose={() => {
          setShowSaved(false)
          setShowBackup(false)
        }}
      >
        <BackupSheet
          open={showBackup}
          book={book}
          onImportFile={(incoming) => {
            setShowBackup(false)
            setShowSaved(false)
            askImport(incoming)
          }}
          onClose={() => setShowBackup(false)}
        />
      </SavedSheet>

      <ImportDialog
        open={showImport}
        pending={pending}
        onConfirm={(incoming) => {
          groups.merge(incoming)
          setShowImport(false)
          setShowSaved(true) // cho thấy ngay các trạm vừa gộp
        }}
        onClose={() => setShowImport(false)}
      />

      {nearby && (
        <NearbySheet
          open={showNearby}
          index={index}
          power={power}
          filters={filters}
          origin={nearby.origin}
          fromGps={nearby.fromGps}
          onPick={(st) => {
            setShowNearby(false)
            pick(st)
          }}
          onClose={() => setShowNearby(false)}
        />
      )}

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
