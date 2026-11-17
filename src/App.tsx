import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { List, LocateFixed, Route, Settings2 } from 'lucide-react'
import { MapView, type TripLayer } from './map/MapView'
import { SearchBar } from './ui/SearchBar'
import { StationSheet } from './ui/StationSheet'
import { GroupsSheet } from './ui/GroupsSheet'
import { SavedSheet } from './ui/SavedSheet'
import { ShareSheet } from './ui/ShareSheet'
import { ChangelogModal } from './ui/ChangelogModal'
import { PowerLegend } from './ui/PowerLegend'
import { NearbySheet } from './ui/NearbySheet'
import { BackupSheet } from './ui/BackupSheet'
import { SettingsSheet } from './ui/SettingsSheet'
import { useDriveDistance, useStableOrigin } from './data/drive'
import { useLiveStatus } from './data/live'
import { filtersFrom, useSettings, type Settings } from './data/settings'
import { useResolvedTheme } from './lib/theme'
import { ImportDialog, pendingImport, type PendingImport } from './ui/ImportDialog'
import { IMPORT_HASH, decodeBackup } from './data/backup'
import { TripPanel } from './ui/TripPanel'
import { useTrip } from './data/useTrip'
import { routeBounds } from './data/routeCorridor'
import { firstUrl } from './lib/mapsLink'
import { useIsMobile } from '@/hooks/use-media-query'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { useStationData } from './data/useStationData'
import { useStationDetail } from './data/useStationDetail'
import { DEFAULT_FILTERS, kwActive, kwLabel, passesFilters, type Filters } from './data/stations'
import { allSaved } from './data/groups'
import { useGroupBook } from './data/useGroupBook'
import { APP_VERSION } from './data/changelog'
import type { Station } from './data/types'
import { parseStationId, readTripLink, stationPath, tripPath } from './lib/stationUrl'
import { LANG, pick as tr, stripLang, withLang } from './i18n'

const T = tr({
  vi: {
    stationTitle: (name: string) => `${name} — Trạm sạc VinFast`,
    loadError: 'Không tải được dữ liệu trạm.',
    loading: 'Đang tải bản đồ trạm sạc…',
    nearMe: 'Gần tôi',
    alongRoute: 'Dọc đường',
    saved: (n: number) => `Đã lưu${n ? ` (${n})` : ''}`,
    active: 'Đang hoạt động',
    list: 'Danh sách',
    settings: 'Cài đặt hiển thị',
    whatsNew: 'Có gì mới',
  },
  en: {
    stationTitle: (name: string) => `${name} — VinFast charging station`,
    loadError: 'Could not load station data.',
    loading: 'Loading charging station map…',
    nearMe: 'Near me',
    alongRoute: 'Along route',
    saved: (n: number) => `Saved${n ? ` (${n})` : ''}`,
    active: 'Operating',
    list: 'List',
    settings: 'Display settings',
    whatsNew: "What's new",
  },
})

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
  // Số cổng trống + lịch sử 24h (EVCS) — chỉ khi bảng trạm đang mở.
  const live = useLiveStatus(sheetStation?.storeId ?? null, selected !== null)
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
  // Quãng đường lái xe (HERE) tới trạm đang mở, từ vị trí GPS — chỉ gọi khi bảng trạm mở.
  const driveOrigin = useStableOrigin(userPos)
  const drive = useDriveDistance(driveOrigin, sheetStation, selected !== null)
  const [showNearby, setShowNearby] = useState(false)
  // Giữ lần mở cuối để bảng còn nội dung lúc trôi xuống (giống sheetStation).
  const [nearby, setNearby] = useState<Nearby | null>(null)
  const groups = useGroupBook()
  const { book } = groups
  const isMobile = useIsMobile()
  // Trang hành trình /trip?link=… (hoặc ?text=/?url= từ Web Share Target): đọc NGAY lúc khởi tạo.
  const [tripLink] = useState(() => readTripLink(location))
  const { settings, update: updateSettings } = useSettings()
  const theme = useResolvedTheme(settings.theme)
  const [showSettings, setShowSettings] = useState(false)
  // Mở app với bộ lọc theo cài đặt; chip đổi tạm trong phiên, không ghi ngược vào cài đặt.
  const [filters, setFilters] = useState<Filters>(() => filtersFrom(settings))
  // Trạm dọc đường theo cùng bộ lọc công suất với bản đồ.
  const tripKeep = useCallback(
    (st: Station) => passesFilters(st, { ...DEFAULT_FILTERS, kw: filters.kw }, power),
    [filters.kw, power],
  )
  const tripCtl = useTrip(index, userPos, settings.tripRadiusKm, tripKeep)
  const { trip, hits } = tripCtl
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
  // Chip kW: bật/tắt tạm trong phiên các mức đã chọn trong cài đặt. Cài đặt chưa chọn mức nào
  // (đủ cả 3) thì chip không có gì để lọc → mở cài đặt.
  const kwPref = kwActive(settings.kwBands)
  function toggleKw() {
    if (!kwPref) return setShowSettings(true)
    setFilters((f) => ({ ...f, kw: kwActive(f.kw) ? [] : settings.kwBands }))
  }
  // Đổi cài đặt thì áp dụng ngay cho phiên hiện tại — chỉ trường vừa đổi, giữ nguyên chip khác.
  function changeSettings(patch: Partial<Settings>) {
    updateSettings(patch)
    if (patch.kwBands !== undefined) setFilters((f) => ({ ...f, kw: patch.kwBands! }))
    if (patch.activeOnly !== undefined) setFilters((f) => ({ ...f, activeOnly: patch.activeOnly! }))
    if (patch.tripRadiusKm !== undefined) tripCtl.setRadius(patch.tripRadiusKm)
  }

  // Mở từ link chia sẻ /station/<id>-<slug>: chọn trạm và bay tới ngay khi có dữ liệu (một lần).
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

  // Mở thẳng /trip: chạy hành trình khi có dữ liệu (một lần). Share target gửi cả đoạn text
  // ("Hà Nội đến Hải Phòng https://…") — chỉ giữ link để URL /trip?link=… gọn.
  const tripHandled = useRef(false)
  useEffect(() => {
    if (!index || tripHandled.current || tripLink === undefined) return
    tripHandled.current = true
    if (tripLink) tripCtl.open(firstUrl(tripLink) ?? tripLink)
    else tripCtl.show()
  }, [index, tripLink, tripCtl])

  // Lớp tuyến cho bản đồ. Chừa chỗ cho bảng hành trình: điện thoại là dải dưới, màn rộng là thẻ trái.
  const tripLayer = useMemo<TripLayer | null>(() => {
    if (!trip.route) return null
    return {
      path: trip.route.points,
      stationIds: new Set(hits.items.map((h) => h.station.entityId)),
      bounds: routeBounds(trip.route.points),
      padding: isMobile
        ? { top: 130, bottom: Math.round(window.innerHeight * 0.55), left: 30, right: 30 }
        : { top: 130, bottom: 60, left: 420, right: 60 },
    }
  }, [trip.route, hits, isMobile])

  // Generation mới (dữ liệu làm mới hằng ngày): trạm đang mở trỏ sang bản ghi mới cùng id.
  useEffect(() => {
    if (!index) return
    setSelected((s) => (s ? (index.byId.get(s.entityId) ?? s) : s))
  }, [index])

  // URL theo trạm đang mở: copy thanh địa chỉ là ra đúng link chia sẻ. replaceState chứ không
  // pushState — bấm qua lại nhiều trạm không làm đầy lịch sử nút Back.
  // Đang mở hành trình thì URL giữ /trip?link=… (mở trạm trong lúc đó KHÔNG đổi sang /station/…):
  // copy URL là gửi được cả hành trình.
  const tripOpen = trip.status !== 'closed'
  useEffect(() => {
    // Chưa tải xong dữ liệu thì chưa biết trạm trong link có tồn tại không — đừng đụng URL.
    if (!index) return
    // Hành trình từ link chưa kịp mở (effect trên chạy cùng lượt) — đừng ghi đè /trip.
    if (tripLink !== undefined && !tripHandled.current) return
    if (tripOpen) {
      const url = tripPath(trip.link ? (firstUrl(trip.link) ?? trip.link) : null)
      if (location.pathname + location.search !== url) history.replaceState(null, '', url)
    } else {
      const path = selected ? stationPath(selected) : withLang('/', LANG)
      // Rời /trip thì bỏ luôn ?link=…; còn lại giữ query (vd. utm_*).
      const search = stripLang(location.pathname).startsWith('/trip') ? '' : location.search
      if (location.pathname !== path || search !== location.search) history.replaceState(null, '', path + search)
    }
    document.title = selected ? T.stationTitle(selected.name) : DEFAULT_TITLE
  }, [index, selected, tripOpen, trip.link, tripLink])

  function pick(st: Station) {
    setSelected(st)
    setFlyTo({ lng: st.lng, lat: st.lat, zoom: 15 })
  }

  if (error) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
        <p>{T.loadError}</p>
        <code className="text-xs">{error}</code>
      </div>
    )
  }
  if (!index) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center text-muted-foreground">
        <div className="size-9 animate-spin rounded-full border-[3px] border-muted border-t-brand" />
        <p>{T.loading}</p>
      </div>
    )
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <MapView
        theme={theme}
        index={index}
        filters={filters}
        book={book}
        power={power}
        selected={selected}
        flyTo={flyTo}
        onSelect={pick}
        onLocate={setUserPos}
        onMoveEnd={(v) => {
          mapCenter.current = { lat: v.lat, lng: v.lng }
        }}
        trip={tripLayer}
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
            {T.nearMe}
          </Chip>
          <Chip variant="floating" selected={tripOpen} onClick={() => (tripOpen ? tripCtl.close() : tripCtl.show())}>
            <Route />
            {T.alongRoute}
          </Chip>
          <FilterChip
            label={T.saved(savedCount)}
            on={filters.favoritesOnly}
            onClick={() => setFilters((f) => ({ ...f, favoritesOnly: !f.favoritesOnly }))}
          />
          <FilterChip label={kwLabel(settings.kwBands)} on={kwActive(filters.kw)} onClick={toggleKw} />
          <FilterChip
            label={T.active}
            on={filters.activeOnly}
            onClick={() => setFilters((f) => ({ ...f, activeOnly: !f.activeOnly }))}
          />
          <Chip variant="floating" onClick={() => setShowSaved(true)}>
            <List />
            {T.list}
          </Chip>
          <Chip variant="floating" aria-label={T.settings} title={T.settings} onClick={() => setShowSettings(true)}>
            <Settings2 />
          </Chip>
        </div>
      </div>

      {settings.showLegend && <PowerLegend />}

      {tripOpen && (
        <TripPanel
          trip={trip}
          hits={hits}
          power={power}
          stationOpen={selected !== null}
          onOpen={tripCtl.open}
          onRadius={tripCtl.setRadius}
          kwBands={filters.kw}
          onKwBands={(kwBands) => changeSettings({ kwBands })}
          onPick={pick}
          onClose={tripCtl.close}
        />
      )}

      <Button
        variant="secondary"
        size="sm"
        className="absolute bottom-3 left-3 z-[5] rounded-full bg-card/90 shadow-lg shadow-black/10 backdrop-blur"
        onClick={() => setShowChangelog(true)}
      >
        v{APP_VERSION} · {T.whatsNew}
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
          drive={drive}
          live={live}
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
          driveOrigin={driveOrigin}
          onPick={(st) => {
            setShowNearby(false)
            pick(st)
          }}
          onClose={() => setShowNearby(false)}
        />
      )}

      <SettingsSheet
        open={showSettings}
        settings={settings}
        onChange={changeSettings}
        onClose={() => setShowSettings(false)}
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
