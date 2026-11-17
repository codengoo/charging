import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapView } from './map/MapView'
import { SearchBar } from './ui/SearchBar'
import { StationSheet } from './ui/StationSheet'
import { GroupsSheet } from './ui/GroupsSheet'
import { SavedSheet } from './ui/SavedSheet'
import { ShareSheet } from './ui/ShareSheet'
import { ChangelogModal } from './ui/ChangelogModal'
import { PowerLegend } from './ui/PowerLegend'
import { NearbySheet } from './ui/NearbySheet'
import { QrScanSheet } from './ui/QrScanSheet'
import { OfflineBadge } from './ui/OfflineBadge'
import { getPosition, type GpsResult } from './lib/geo'
import { BackupSheet } from './ui/BackupSheet'
import { SettingsSheet } from './ui/SettingsSheet'
import { VehicleSheet } from './ui/VehicleSheet'
import { useDriveDistance, useStableOrigin } from './data/drive'
import { useLiveStatus } from './data/live'
import { filtersFrom, useSettings, type Settings } from './data/settings'
import { useBattery } from './data/useBattery'
import { vehicleOf } from './data/vehicles'
import { useResolvedTheme } from './lib/theme'
import { ImportDialog, pendingImport, type PendingImport } from './ui/ImportDialog'
import { useNotes } from './data/notes'
import { newPlaceId, placeName, usePlaces } from './data/places'
import { PlacesSheet } from './ui/PlacesSheet'
import { PlaceEditorPanel, type PlaceEditTarget } from './ui/PlaceEditorPanel'
import { reverse, type PlaceHit } from './data/trip'
import type { SheetName } from './app/useSheets'
import { PointSheet } from './ui/PointSheet'
import { directionsLink } from './lib/mapsLink'
import { useReviews } from './data/reviews'
import { TripPanel } from './ui/TripPanel'
import { useTrip } from './data/useTrip'
import { useIsMobile } from '@/hooks/use-media-query'
import { Button } from '@/components/ui/button'
import { useStationData } from './data/useStationData'
import { useStationDetail } from './data/useStationDetail'
import { DEFAULT_FILTERS, kwActive, kwLabel, passesFilters, type Filters } from './data/stations'
import { allSaved } from './data/groups'
import { useGroupBook } from './data/useGroupBook'
import { APP_VERSION } from './data/changelog'
import type { Station } from './data/types'
import { pick as tr } from './i18n'
import { useUrlSync } from './app/useUrlSync'
import { useTripPlan } from './app/useTripPlan'
import { useSheets } from './app/useSheets'
import { MapChips } from './app/MapChips'

const T = tr({
  vi: {
    loadError: 'Không tải được dữ liệu trạm.',
    loading: 'Đang tải bản đồ trạm sạc…',
    whatsNew: 'Có gì mới',
  },
  en: {
    loadError: 'Could not load station data.',
    loading: 'Loading charging station map…',
    whatsNew: "What's new",
  },
})

/** Lần mở bảng "Gần tôi": điểm gốc chụp lúc bấm, kèm nguồn (GPS hay tâm bản đồ). */
interface Nearby {
  origin: { lat: number; lng: number }
  fromGps: boolean
  /** Gốc là địa điểm / điểm chạm giữ — tiêu đề "Trạm gần <label>". */
  label?: string
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
  const reviews = useReviews(sheetStation?.entityId ?? null, selected !== null)
  const live = useLiveStatus(sheetStation?.storeId ?? null, selected !== null)
  const sheets = useSheets()
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; zoom?: number } | null>(null)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  // Tâm bản đồ hiện tại (ref: đổi liên tục khi kéo, không cần render lại). Mặc định = tâm mặc định của map.
  const mapCenter = useRef({ lat: 16.05, lng: 108.2 })
  // Quãng đường lái xe (HERE) tới trạm đang mở, từ vị trí GPS — chỉ gọi khi bảng trạm mở.
  const driveOrigin = useStableOrigin(userPos)
  const drive = useDriveDistance(driveOrigin, sheetStation, selected !== null)
  // Giữ lần mở cuối để bảng còn nội dung lúc trôi xuống (giống sheetStation).
  const [nearby, setNearby] = useState<Nearby | null>(null)
  const groups = useGroupBook()
  const notes = useNotes()
  const places = usePlaces()
  const { book } = groups
  const isMobile = useIsMobile()
  const { settings, update: updateSettings } = useSettings()
  const theme = useResolvedTheme(settings.theme)
  // Ước tính % pin khi đến: xe trong Cài đặt + % pin người dùng kéo (dùng chung bảng trạm / Dọc đường).
  const battery = useBattery()
  const vehicle = useMemo(
    () => vehicleOf(settings.vehicleId, settings.customKwh, settings.customKwhPer100, settings.usageOverride),
    [settings.vehicleId, settings.customKwh, settings.customKwhPer100, settings.usageOverride],
  )
  // Mở app với bộ lọc theo cài đặt; chip đổi tạm trong phiên, không ghi ngược vào cài đặt.
  const [filters, setFilters] = useState<Filters>(() => filtersFrom(settings))
  // Trạm dọc đường theo cùng bộ lọc công suất với bản đồ.
  const tripKeep = useCallback(
    (st: Station) => passesFilters(st, { ...DEFAULT_FILTERS, kw: filters.kw }, power),
    [filters.kw, power],
  )
  const tripCtl = useTrip(index, userPos, settings.tripRadiusKm, tripKeep)
  const { trip, hits } = tripCtl
  // Giữ lần nhập cuối để hộp xác nhận còn nội dung lúc trôi xuống.
  const [pending, setPending] = useState<PendingImport | null>(null)
  // Đặt địa điểm: bảng nổi không chặn bản đồ (PlaceEditorPanel) — TẠM ẨN các bảng đang xếp chồng
  // (đóng rồi mở lại khi xong: giữ chúng mở thì Radix chặn bấm bản đồ và giữ focus), chạm bản đồ để chọn.
  const [editTarget, setEditTarget] = useState<PlaceEditTarget | null>(null)
  const [editPin, setEditPin] = useState<{ lat: number; lng: number } | null>(null)
  const [mapPick, setMapPick] = useState<PlaceHit | null>(null)
  const restoreSheets = useRef<SheetName[]>([])
  function startPlaceEdit(t: PlaceEditTarget) {
    restoreSheets.current = (['settings', 'settingsPlaces', 'places'] as const).filter((n) => sheets.is(n))
    sheets.close('settings', 'settingsPlaces', 'places', 'point', 'nearby')
    setSelected(null)
    setMapPick(null)
    setEditTarget(t)
  }
  function endPlaceEdit() {
    setEditTarget(null)
    setEditPin(null)
    setMapPick(null)
    for (const n of restoreSheets.current) sheets.open(n)
    restoreSheets.current = []
  }
  /** Chạm bản đồ khi đang đặt: ghim ngay (toạ độ), tên chỗ hỏi HERE rồi điền sau. */
  function pickOnMap(pt: { lat: number; lng: number }) {
    const coords = `${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}`
    setMapPick({ label: coords, address: '', ...pt })
    setEditPin(pt)
    void reverse(pt, new AbortController().signal)
      .then((label) => label && setMapPick((cur) => (cur && cur.lat === pt.lat && cur.lng === pt.lng ? { ...cur, label } : cur)))
      .catch(() => {})
  }

  // Chạm giữ bản đồ / bấm ghim địa điểm → bảng "Chỗ này".
  const [point, setPoint] = useState<{ at: { lat: number; lng: number }; placeId: string | null } | null>(null)
  function openPoint(at: { lat: number; lng: number }, placeId: string | null) {
    setPoint({ at, placeId })
    sheets.open('point')
  }
  const mapPlaces = useMemo(
    () => places.places.map((p) => ({ id: p.id, kind: p.kind, name: placeName(p), lat: p.lat, lng: p.lng })),
    [places.places],
  )

  function askImport(incoming: Parameters<typeof pendingImport>[3]) {
    setPending(pendingImport(book, notes.notes, places.places, incoming))
    sheets.open('import')
  }
  const savedCount = allSaved(book).size
  // Chip kW: bật/tắt tạm trong phiên các mức đã chọn trong cài đặt. Cài đặt chưa chọn mức nào
  // (đủ cả 3) thì chip không có gì để lọc → mở cài đặt.
  const kwPref = kwActive(settings.kwBands)
  function toggleKw() {
    if (!kwPref) return sheets.open('settings')
    setFilters((f) => ({ ...f, kw: kwActive(f.kw) ? [] : settings.kwBands }))
  }
  // Đổi cài đặt thì áp dụng ngay cho phiên hiện tại — chỉ trường vừa đổi, giữ nguyên chip khác.
  function changeSettings(patch: Partial<Settings>) {
    updateSettings(patch)
    if (patch.kwBands !== undefined) setFilters((f) => ({ ...f, kw: patch.kwBands! }))
    if (patch.activeOnly !== undefined) setFilters((f) => ({ ...f, activeOnly: patch.activeOnly! }))
    if (patch.tripRadiusKm !== undefined) tripCtl.setRadius(patch.tripRadiusKm)
  }

  useUrlSync({ index, selected, tripCtl, pick, askImport })
  const tripOpen = trip.status !== 'closed'
  // Giữ bảng Dọc đường trong cây sau lần mở đầu: gỡ ngay khi đóng thì drawer mất luôn, không trượt xuống.
  const [tripMounted, setTripMounted] = useState(false)
  useEffect(() => {
    if (tripOpen) setTripMounted(true)
  }, [tripOpen])

  const plan = useTripPlan({
    trip,
    hits,
    power,
    vehicle,
    battery: battery.reading,
    climate: settings.climate,
    reservePct: settings.reservePct,
    isMobile,
  })

  // Generation mới (dữ liệu làm mới hằng ngày): trạm đang mở trỏ sang bản ghi mới cùng id.
  useEffect(() => {
    if (!index) return
    setSelected((s) => (s ? (index.byId.get(s.entityId) ?? s) : s))
  }, [index])

  /** Nút "Dùng vị trí của tôi" trong Trạm gần bạn: hỏi vị trí, có thì xếp lại theo chỗ đứng. */
  async function requestGps(): Promise<GpsResult> {
    const { pos, result } = await getPosition(true)
    if (pos) {
      setUserPos(pos)
      setNearby({ origin: pos, fromGps: true })
    }
    return result
  }

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
        onSelect={(st) => (editTarget ? undefined : pick(st))}
        onLocate={setUserPos}
        onMoveEnd={(v) => {
          mapCenter.current = { lat: v.lat, lng: v.lng }
        }}
        trip={plan.layer}
        onPickRoute={tripCtl.selectRoute}
        places={mapPlaces}
        onPlaceClick={(id) => {
          const pl = places.places.find((x) => x.id === id)
          if (pl) openPoint({ lat: pl.lat, lng: pl.lng }, id)
        }}
        onLongPress={(pt) => (editTarget ? pickOnMap(pt) : openPoint(pt, null))}
        pinAt={editTarget ? editPin : sheets.is('point') && point && !point.placeId ? point.at : null}
        onMapClick={editTarget ? pickOnMap : undefined}
      />

      {/* Status bar trong suốt (PWA iOS): chữ giờ/pin luôn trắng — dải mờ tối cho đọc được trên nền bản đồ sáng.
          Cao đúng bằng vùng tai thỏ, ngoài PWA thì bằng 0 nên không hiện. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[env(safe-area-inset-top)] bg-gradient-to-b from-black/45 to-black/10" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* relative z-10: danh sách kết quả tìm kiếm phải đè lên hàng chip phía dưới. */}
        <div className="pointer-events-auto relative z-10">
          <SearchBar index={index} onPick={pick} onSettings={() => sheets.open('settings')} onScan={() => sheets.open('scan')} />
        </div>
        <MapChips
          onNearby={() => {
            setNearby(userPos ? { origin: userPos, fromGps: true } : { origin: mapCenter.current, fromGps: false })
            sheets.open('nearby')
          }}
          tripOpen={tripOpen}
          onToggleTrip={() => (tripOpen ? tripCtl.close() : tripCtl.show())}
          savedCount={savedCount}
          savedOnly={filters.favoritesOnly}
          onToggleSaved={() => setFilters((f) => ({ ...f, favoritesOnly: !f.favoritesOnly }))}
          kwLabel={kwLabel(settings.kwBands)}
          kwOn={kwActive(filters.kw)}
          onToggleKw={toggleKw}
          onList={() => sheets.open('saved')}
        />
        <OfflineBadge />
      </div>

      {settings.showLegend && <PowerLegend />}

      {tripMounted && (
        <TripPanel
          visible={tripOpen && !editTarget}
          trip={trip}
          hits={hits}
          power={power}
          stationOpen={selected !== null}
          onOpen={tripCtl.open}
          onRadius={tripCtl.setRadius}
          routeTotals={tripCtl.routeTotals}
          onSelectRoute={tripCtl.selectRoute}
          onAvoid={tripCtl.setAvoid}
          kwBands={filters.kw}
          onKwBands={(kwBands) => changeSettings({ kwBands })}
          onPick={pick}
          places={places.places}
          onRouteTo={(to, from) => tripCtl.open(directionsLink(to, from))}
          onManagePlaces={() => sheets.open('places')}
          onClose={tripCtl.close}
          vehicle={vehicle}
          climate={settings.climate}
          reservePct={settings.reservePct}
          battery={battery.reading}
          batteryStale={battery.stale}
          onBattery={battery.set}
          planOn={plan.planOn}
          plan={plan.plan}
          onTogglePlan={plan.togglePlan}
        />
      )}

      <Button
        variant="secondary"
        size="sm"
        className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-[5] rounded-full bg-card/90 shadow-lg shadow-black/10 backdrop-blur"
        onClick={() => sheets.open('changelog')}
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
          vehicle={vehicle}
          climate={settings.climate}
          battery={battery.reading}
          batteryStale={battery.stale}
          onBattery={battery.set}
          onPickCar={() => sheets.open('car')}
          note={notes.notes[sheetStation.entityId]}
          onNote={(text) => notes.set(sheetStation.entityId, text)}
          reviews={reviews}
          theme={theme}
          onOpenGroups={() => sheets.open('groups')}
          onShare={() => sheets.open('share')}
          onClose={() => {
            setSelected(null)
            sheets.closeStationChildren()
          }}
        >
          <VehicleSheet
            nested
            open={sheets.is('car')}
            settings={settings}
            onChange={changeSettings}
            onClose={() => sheets.close('car')}
          />
          <ShareSheet open={sheets.is('share')} station={sheetStation} onClose={() => sheets.close('share')} />
          <GroupsSheet
            open={sheets.is('groups')}
            book={book}
            now={groups.now}
            entityId={sheetStation.entityId}
            stationName={sheetStation.name}
            onToggle={(g) => groups.toggle(g, sheetStation.entityId)}
            onCreate={(g) => groups.create(g, sheetStation.entityId)}
            onDelete={groups.remove}
            onTtlChange={groups.setTtl}
            onClose={() => sheets.close('groups')}
          />
        </StationSheet>
      )}

      <SavedSheet
        open={sheets.is('saved')}
        index={index}
        book={book}
        notes={notes.notes}
        now={groups.now}
        userPos={userPos}
        onPick={(st) => {
          sheets.close('saved')
          pick(st)
        }}
        onUnsave={groups.removeFromAll}
        onBackup={() => sheets.open('backup')}
        onClose={() => sheets.close('saved')}
      >
        <BackupSheet
          open={sheets.is('backup')}
          book={book}
          notes={notes.notes}
          places={places.places}
          onImportFile={(incoming) => {
            sheets.close('saved')
            askImport(incoming)
          }}
          onClose={() => sheets.close('backup')}
        />
      </SavedSheet>

      <QrScanSheet
        open={sheets.is('scan')}
        index={index}
        onFound={(st) => {
          sheets.close('scan')
          pick(st)
        }}
        onClose={() => sheets.close('scan')}
      />

      <ImportDialog
        open={sheets.is('import')}
        pending={pending}
        onConfirm={(incoming) => {
          groups.merge(incoming.book)
          notes.merge(incoming.notes)
          places.merge(incoming.places)
          sheets.close('import')
          sheets.open('saved') // cho thấy ngay các trạm vừa gộp
        }}
        onClose={() => sheets.close('import')}
      />

      {nearby && (
        <NearbySheet
          open={sheets.is('nearby')}
          index={index}
          power={power}
          filters={filters}
          origin={nearby.origin}
          fromGps={nearby.fromGps}
          originLabel={nearby.label}
          places={places.places}
          onOrigin={(pl) =>
            setNearby(
              pl
                ? { origin: { lat: pl.lat, lng: pl.lng }, fromGps: false, label: placeName(pl) }
                : userPos
                  ? { origin: userPos, fromGps: true }
                  : { origin: mapCenter.current, fromGps: false },
            )
          }
          driveOrigin={driveOrigin}
          onRequestGps={requestGps}
          onPick={(st) => {
            sheets.close('nearby')
            pick(st)
          }}
          onClose={() => sheets.close('nearby')}
        />
      )}

      <SettingsSheet
        open={sheets.is('settings')}
        settings={settings}
        onChange={changeSettings}
        onClose={() => sheets.close('settings')}
        placesSummary={places.places.length ? places.places.map(placeName).join(' · ') : null}
        onOpenPlaces={() => sheets.open('settingsPlaces')}
      >
        <PlacesSheet
          nested
          open={sheets.is('settingsPlaces')}
          onClose={() => sheets.close('settingsPlaces')}
          places={places.places}
          onRemove={places.remove}
          onEdit={startPlaceEdit}
        />
      </SettingsSheet>

      <PlacesSheet
        open={sheets.is('places')}
        onClose={() => sheets.close('places')}
        places={places.places}
        onRemove={places.remove}
        onEdit={startPlaceEdit}
      />

      {editTarget && (
        <PlaceEditorPanel
          key={editTarget.id}
          target={editTarget}
          near={userPos ?? mapCenter.current}
          mapPick={mapPick}
          onChosen={(hit, fly) => {
            setEditPin(hit ? { lat: hit.lat, lng: hit.lng } : null)
            if (fly && hit) setFlyTo({ lat: hit.lat, lng: hit.lng, zoom: 16 })
          }}
          onSave={(t) => {
            const hit = t.hit!
            places.save({ id: t.id, kind: t.kind, name: t.name.trim(), lat: hit.lat, lng: hit.lng, address: hit.address ? `${hit.label}, ${hit.address}` : hit.label })
            endPlaceEdit()
          }}
          onCancel={endPlaceEdit}
        />
      )}

      <PointSheet
        open={sheets.is('point')}
        onClose={() => sheets.close('point')}
        point={point?.at ?? null}
        place={places.places.find((x) => x.id === point?.placeId) ?? null}
        places={places.places}
        onRoute={(pt) => {
          sheets.close('point')
          setSelected(null)
          tripCtl.open(directionsLink(pt))
        }}
        onNearby={(pt, label) => {
          sheets.close('point')
          setNearby({ origin: pt, fromGps: false, label })
          sheets.open('nearby')
        }}
        onSave={(kind, pt, label) => {
          sheets.close('point')
          // Nhà / Công ty lưu luôn; địa điểm khác cần đặt tên → màn đặt địa điểm.
          if (kind === 'custom') startPlaceEdit({ id: newPlaceId(), kind, name: '', hit: { label, address: '', lat: pt.lat, lng: pt.lng }, isNew: true })
          else places.save({ id: kind, kind, name: '', lat: pt.lat, lng: pt.lng, address: label })
        }}
        onEditPlaces={() => {
          sheets.close('point')
          sheets.open('places')
        }}
      />

      <ChangelogModal open={sheets.is('changelog')} onClose={() => sheets.close('changelog')} />
    </div>
  )
}
