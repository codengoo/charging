import { useEffect, useRef, useState, type ReactNode } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Locate, LocateFixed, LocateOff } from 'lucide-react'
import { pick } from '../i18n'
import type { Station, StationPower } from '../data/types'
import type { Filters, StationIndex } from '../data/stations'
import type { GroupBook } from '../data/groups'
import { distanceKm } from '../lib/geo'
import { createPlaceMarkers, type MapPlace } from './placeMarkers'
import {
  OWN_SOURCES,
  SRC,
  SRC_SELECTED,
  addAppLayers,
  applyTrip,
  bindLayerEvents,
  ensurePinImages,
  notSelected,
  pointFilter,
  rangeBounds,
  selectedGeoJSON,
  setRange,
  toGeoJSON,
  type RangeLayer,
  type TripLayer,
} from './layers'

export type { RangeLayer, TripLayer } from './layers'

// Trung tâm VN (Đà Nẵng) làm mặc định khi chưa có vị trí người dùng.
const DEFAULT_CENTER: [number, number] = [108.2, 16.05]
/** Vị trí GPS mới chỉ báo lên App khi lệch bản trước ≥ 50 m. */
const LOCATE_MIN_KM = 0.05
// Positron = nền xám nhạt, tối giản, ít POI — tương đương HERE "lite.day" của app mobile,
// để ghim trạm nổi bật trên nền. (Các lựa chọn khác: liberty, bright.) Giao diện tối dùng
// "dark" cùng nhà — chung sprite và glyphs nên đổi qua lại không phải nạp lại font.
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const

const L = pick({
  vi: { locate: 'Về vị trí của tôi', locating: 'Đang tìm vị trí…', denied: 'Không lấy được vị trí — kiểm tra quyền vị trí của trình duyệt' },
  en: { locate: 'Go to my location', locating: 'Finding your location…', denied: 'Location unavailable — check browser location permission' },
})

/** Trạng thái nút định vị, suy từ `_watchState` (trường nội bộ maplibre 4.x) của GeolocateControl. */
type LocState = 'off' | 'waiting' | 'active' | 'background' | 'error'
type WatchState = 'OFF' | 'WAITING_ACTIVE' | 'ACTIVE_LOCK' | 'ACTIVE_ERROR' | 'BACKGROUND' | 'BACKGROUND_ERROR'
type GeoInternal = { _watchState: WatchState; _lastKnownPosition?: GeolocationPosition }

interface Props {
  index: StationIndex
  filters: Filters
  book: GroupBook
  /** Số cổng + kW (tải sau base). null = chưa có — ghim tạm một màu, lọc công suất ẩn hết. */
  power: Map<string, StationPower> | null
  selected: Station | null
  flyTo: { lng: number; lat: number; zoom?: number } | null
  onSelect: (st: Station) => void
  onLocate?: (pos: { lat: number; lng: number }) => void
  /** Tâm bản đồ sau mỗi lần kéo/zoom — "Gần tôi" dùng khi chưa có GPS. */
  onMoveEnd?: (view: { lat: number; lng: number; zoom: number }) => void
  /** Hành trình đang mở (null = bản đồ thường). */
  trip?: TripLayer | null
  /** Chạm vào tuyến phụ trên bản đồ. */
  onPickRoute?: (idx: number) => void
  /** Nền bản đồ theo giao diện sáng / tối. */
  theme?: 'light' | 'dark'
  /** Địa điểm hay dùng (Nhà, Công ty…) vẽ thành ghim; bấm → onPlaceClick. */
  places?: MapPlace[]
  onPlaceClick?: (id: string) => void
  /** Chạm giữ (điện thoại) / chuột phải (máy tính) trên bản đồ. */
  onLongPress?: (p: { lat: number; lng: number }) => void
  /** Ghim tạm ở điểm vừa chạm giữ (đang mở bảng "Chỗ này") / điểm đang chọn khi đặt địa điểm. */
  pinAt?: { lat: number; lng: number } | null
  /** Chạm (click) bản đồ — chỉ truyền khi đang chọn chỗ (đặt địa điểm). */
  onMapClick?: (p: { lat: number; lng: number }) => void
  /** Phần nổi xếp trên nút định vị ở góc dưới phải (chú giải màu ghim). */
  overlay?: ReactNode
  /** Vòng tầm pin; null = tắt. Bật lên thì camera bay cho vừa vòng ngoài. */
  range?: RangeLayer | null
}

/** Ghi công bản đồ mở ra bao lâu thì tự thu gọn lại. */
const ATTRIB_SHOW_MS = 4000

/** Giữ ngón tay chừng này (ms) không di chuyển quá LONG_PRESS_SLOP px thì coi là chạm giữ. */
const LONG_PRESS_MS = 550
const LONG_PRESS_SLOP = 10

export function MapView({ index, filters, book, power, selected, flyTo, onSelect, onLocate, onMoveEnd, trip = null, onPickRoute, theme = 'light', places = [], onPlaceClick, onLongPress, pinAt = null, onMapClick, overlay, range = null }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const loadedRef = useRef(false)
  // Giá trị mới nhất cho các handler đăng ký một lần trong lúc khởi tạo.
  const latest = useRef({ index, filters, book, power, selected, onSelect, onLocate, onMoveEnd, trip, onPickRoute, onPlaceClick, onLongPress, onMapClick })
  latest.current = { index, filters, book, power, selected, onSelect, onLocate, onMoveEnd, trip, onPickRoute, onPlaceClick, onLongPress, onMapClick }
  const placeMarkers = useRef<ReturnType<typeof createPlaceMarkers> | null>(null)
  const pinMarker = useRef<maplibregl.Marker | null>(null)
  const geoRef = useRef<maplibregl.GeolocateControl | null>(null)
  const [loc, setLoc] = useState<LocState>('off')

  // Khởi tạo map một lần.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLES[theme],
      center: DEFAULT_CENTER,
      zoom: 5,
      // Tự thêm bên dưới để đặt góc dưới TRÁI (góc phải dành cho nút định vị + số phiên bản).
      attributionControl: false,
    })
    const attrib = new maplibregl.AttributionControl({ compact: true })
    map.addControl(attrib, 'bottom-left')
    // Ghi công dạng gọn: maplibre mở sẵn lúc tải và chỉ thu lại khi kéo bản đồ. Tự thu sau vài giây
    // mỗi lần nó mở ra (lúc tải, hoặc người dùng bấm ⓘ xem) — vẫn đủ thời gian đọc.
    const attribEl = map.getContainer().querySelector<HTMLElement>('.maplibregl-ctrl-attrib')
    let attribTimer: ReturnType<typeof setTimeout> | null = null
    const attribObserver = new MutationObserver(() => {
      if (!attribEl?.classList.contains('maplibregl-compact-show')) return
      if (attribTimer) clearTimeout(attribTimer)
      attribTimer = setTimeout(() => {
        ;(attrib as unknown as { _updateCompactMinimize: () => void })._updateCompactMinimize()
      }, ATTRIB_SHOW_MS)
    })
    if (attribEl) attribObserver.observe(attribEl, { attributes: true, attributeFilter: ['class'] })
    mapRef.current = map
    if (import.meta.env.DEV) (window as unknown as { __map: maplibregl.Map }).__map = map

    const geo = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true,
    })
    map.addControl(geo, 'top-right')
    geoRef.current = geo
    // Ẩn nút gốc của control (nút định vị riêng ở góc dưới phải, xem cuối file): control vẫn cần để
    // vẽ chấm vị trí, tự bay về chỗ người dùng lúc mở và báo onLocate. Góc trên phải chỉ có control này.
    const corner = map.getContainer().querySelector<HTMLElement>('.maplibregl-ctrl-top-right')
    if (corner) corner.style.display = 'none'
    // Nút định vị riêng phản chiếu trạng thái control.
    const syncLoc = () => {
      const { _watchState: s, _lastKnownPosition: fix } = geo as unknown as GeoInternal
      // Bám theo / nền mà chưa có toạ độ nào (GPS chưa trả, hoặc trình duyệt treo không hỏi quyền)
      // vẫn là đang tìm — đừng hiện xanh như đã định vị được.
      const searching = !fix && (s === 'ACTIVE_LOCK' || s === 'BACKGROUND')
      setLoc(
        s === 'WAITING_ACTIVE' || searching ? 'waiting'
        : s === 'ACTIVE_LOCK' ? 'active'
        : s === 'BACKGROUND' ? 'background'
        : s === 'OFF' ? 'off'
        : 'error',
      )
    }
    for (const ev of ['trackuserlocationstart', 'trackuserlocationend', 'userlocationlostfocus', 'userlocationfocus', 'geolocate'] as const) {
      geo.on(ev, syncLoc)
    }
    // Bị từ chối quyền: control về OFF — vẫn hiện dạng lỗi để người dùng biết vì sao.
    geo.on('error', (e: GeolocationPositionError) => (e.code === 1 ? setLoc('error') : syncLoc()))
    // Theo dõi vị trí bắn ~1 lần/giây trên điện thoại; mỗi lần báo lên là App render lại cả cây.
    // Chỉ báo khi dịch đủ xa — đứng yên GPS vẫn nhảy vài chục mét.
    let reported: { lat: number; lng: number } | null = null
    geo.on('geolocate', (e: GeolocationPosition) => {
      const pos = { lat: e.coords.latitude, lng: e.coords.longitude }
      if (reported && distanceKm(reported.lat, reported.lng, pos.lat, pos.lng) < LOCATE_MIN_KM) return
      reported = pos
      latest.current.onLocate?.(pos)
    })
    // Fix đầu tiên về sau khi camera đã đi chỗ khác (mở link trạm / hành trình, người dùng kéo
    // bản đồ) thì đừng kéo camera về vị trí người dùng. Lúc chờ fix (WAITING_ACTIVE) control không
    // tự chuyển sang BACKGROUND khi camera di chuyển — tự đặt (trường nội bộ của maplibre 4.x).
    map.on('movestart', (e: { geolocateSource?: boolean; originalEvent?: Event }) => {
      const g = geo as unknown as { _watchState: string }
      if (e.geolocateSource || e.originalEvent?.type === 'resize') return
      if (g._watchState === 'WAITING_ACTIVE') {
        g._watchState = 'BACKGROUND'
        syncLoc()
      }
    })

    // Chạm giữ: maplibre không phát sự kiện riêng, iOS Safari cũng không bắn contextmenu khi chạm giữ
    // — tự đo trên touch. Máy tính / Android còn có contextmenu (chuột phải / chạm giữ) — chặn bắn đôi.
    let pressTimer: ReturnType<typeof setTimeout> | null = null
    let pressAt: maplibregl.Point | null = null
    let lastLongPress = 0
    const fireLongPress = (ll: maplibregl.LngLat) => {
      if (Date.now() - lastLongPress < 800) return
      lastLongPress = Date.now()
      latest.current.onLongPress?.({ lat: ll.lat, lng: ll.lng })
    }
    const cancelPress = () => {
      if (pressTimer) clearTimeout(pressTimer)
      pressTimer = null
      pressAt = null
    }
    map.on('touchstart', (e) => {
      cancelPress()
      if (e.originalEvent.touches.length !== 1) return
      pressAt = e.point
      const ll = e.lngLat
      pressTimer = setTimeout(() => fireLongPress(ll), LONG_PRESS_MS)
    })
    map.on('touchmove', (e) => {
      if (pressAt && e.point.dist(pressAt) > LONG_PRESS_SLOP) cancelPress()
    })
    map.on('touchend', cancelPress)
    map.on('touchcancel', cancelPress)
    map.on('contextmenu', (e) => fireLongPress(e.lngLat))
    map.on('click', (e) => latest.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }))

    map.on('moveend', () => {
      const c = map.getCenter()
      latest.current.onMoveEnd?.({ lat: c.lat, lng: c.lng, zoom: map.getZoom() })
    })

    // Ảnh ghim nằm ở image manager và thường sống qua setStyle; style nào làm rơi mất thì nạp lại.
    // Sự kiện bắn cho từng ảnh thiếu — gộp thành một lượt nạp.
    let pinsLoading: Promise<void> | null = null
    map.on('styleimagemissing', () => {
      pinsLoading ??= ensurePinImages(map, latest.current.book.groups).finally(() => (pinsLoading = null))
    })

    map.on('load', () => {
      const { index: idx, filters: f, book: b, power: p, selected: sel } = latest.current
      addAppLayers(map, toGeoJSON(idx, f, b, p), sel)
      bindLayerEvents(map, {
        select: (id) => {
          const st = latest.current.index.byId.get(id)
          if (st) latest.current.onSelect(st)
        },
        pickRoute: (idx) => latest.current.onPickRoute?.(idx),
      })

      loadedRef.current = true
      placeMarkers.current = createPlaceMarkers(map, (id) => latest.current.onPlaceClick?.(id))
      placeMarkers.current.sync(latestPlaces.current)
      applyTrip(map, latest.current.trip, idx, b, p)
      setRange(map, latestRange.current)
      void ensurePinImages(map, latest.current.book.groups)
      // Thử lấy vị trí người dùng ngay lần mở (mirror: mở app là về vị trí hiện tại).
      geo.trigger()
    })

    return () => {
      attribObserver.disconnect()
      if (attribTimer) clearTimeout(attribTimer)
      map.remove()
      mapRef.current = null
      loadedRef.current = false
    }
    // Khởi tạo MỘT lần. Dữ liệu đổi (generation mới, lọc, nhóm) chỉ setData ở effect dưới —
    // dựng lại map sẽ chớp màn hình và mất vị trí đang xem.
  }, [])

  // Cập nhật dữ liệu khi filter / sổ nhóm đổi, hoặc power tải xong (có màu theo mức).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const src = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined
    src?.setData(toGeoJSON(index, filters, book, power))
  }, [index, filters, book, power])

  // Đổi nền sáng/tối tại chỗ: giữ nguyên nguồn + lớp của app (ghim, tuyến) bằng transformStyle,
  // camera không nhảy. Ảnh ghim (addImage) nằm ở image manager, không mất khi đổi style.
  const styleTheme = useRef(theme)
  useEffect(() => {
    const map = mapRef.current
    if (!map || styleTheme.current === theme) return
    styleTheme.current = theme
    map.setStyle(STYLES[theme], {
      transformStyle: (prev, next) => {
        if (!prev) return next
        const sources = { ...next.sources }
        for (const [id, src] of Object.entries(prev.sources)) if (OWN_SOURCES.has(id)) sources[id] = src
        const own = prev.layers.filter((l) => 'source' in l && OWN_SOURCES.has(l.source as string))
        return { ...next, sources, layers: [...next.layers, ...own] }
      },
    })
  }, [theme])

  // Nhóm mới tạo cần ảnh ghim riêng.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    void ensurePinImages(map, book.groups)
  }, [book.groups])

  // Đổi trạm đang chọn.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    ;(map.getSource(SRC_SELECTED) as maplibregl.GeoJSONSource | undefined)?.setData(
      selectedGeoJSON(selected),
    )
    if (map.getLayer('point')) {
      map.setFilter('point', pointFilter(selected?.entityId ?? ''))
    }
    if (map.getLayer('trip-point')) map.setFilter('trip-point', notSelected(selected?.entityId ?? ''))
  }, [selected])

  // Hành trình: vẽ tuyến + chỉ ghim dọc tuyến; đóng thì về bản đồ cụm như cũ.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    applyTrip(map, trip, index, book, power)
  }, [trip, index, book, power])

  // Tuyến mới → bay camera cho vừa tuyến, chừa chỗ cho bảng hành trình. Theo khung TUYẾN, không
  // theo bán kính: đổi 2 → 5 km không được kéo camera đi.
  const boundsKey = trip?.bounds ? trip.bounds.flat().join(',') : ''
  useEffect(() => {
    const map = mapRef.current
    const t = latest.current.trip
    if (!map || !t?.bounds) return
    map.fitBounds(t.bounds, { padding: t.padding, duration: 800 })
  }, [boundsKey])

  // Vòng tầm pin. Vừa bật (tắt → bật) thì bay cho vừa vòng ngoài; kéo % pin / GPS dịch chỉ vẽ lại.
  const latestRange = useRef(range)
  latestRange.current = range
  const rangeWasOn = useRef(false)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    setRange(map, range)
    const on = range !== null
    if (on && !rangeWasOn.current) {
      const b = rangeBounds(range)
      // Chừa phía trên cho ô tìm kiếm + chip + thẻ tầm pin.
      if (b) map.fitBounds(b, { padding: { top: 290, bottom: 70, left: 30, right: 30 }, maxZoom: 13, duration: 800 })
    }
    rangeWasOn.current = on
  }, [range])

  // Địa điểm hay dùng → ghim (đồng bộ theo danh sách; lần đầu đồng bộ trong 'load').
  const latestPlaces = useRef(places)
  latestPlaces.current = places
  useEffect(() => {
    placeMarkers.current?.sync(places)
  }, [places])
  useEffect(() => () => placeMarkers.current?.destroy(), [])

  // Ghim tạm ở điểm chạm giữ.
  useEffect(() => {
    const map = mapRef.current
    pinMarker.current?.remove()
    pinMarker.current = null
    if (!map || !pinAt) return
    pinMarker.current = new maplibregl.Marker({ color: '#009966' }).setLngLat([pinAt.lng, pinAt.lat]).addTo(map)
  }, [pinAt])

  // Bay tới trạm/địa điểm được chọn từ ngoài.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyTo) return
    map.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? 15 })
  }, [flyTo])

  // Nút định vị. Không gọi thẳng geo.trigger() như nút gốc: ở ACTIVE_LOCK / WAITING_ACTIVE nút gốc
  // TẮT theo dõi (mất chấm vị trí) — ở đây bấm luôn nghĩa là "đưa tôi về chỗ tôi đứng".
  function locate() {
    const geo = geoRef.current
    const map = mapRef.current
    if (!geo || !map) return
    const g = geo as unknown as GeoInternal
    switch (g._watchState) {
      case 'WAITING_ACTIVE':
        return
      case 'ACTIVE_LOCK': {
        const p = g._lastKnownPosition
        // geolocateSource: như camera của control — không thì control coi là người dùng kéo, thả về BACKGROUND.
        if (p) map.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: Math.max(map.getZoom(), 15) }, { geolocateSource: true })
        return
      }
      case 'ACTIVE_ERROR':
      case 'BACKGROUND_ERROR':
        geo.trigger() // → OFF, rồi bật lại bên dưới để thử lấy vị trí lần nữa
        geo.trigger()
        return
      default: // OFF (kể cả sau khi bị từ chối quyền — thử hỏi lại), BACKGROUND (bay về + bám theo)
        geo.trigger()
    }
  }

  const LocIcon = loc === 'error' ? LocateOff : loc === 'active' || loc === 'waiting' ? LocateFixed : Locate
  const locLabel = loc === 'waiting' ? L.locating : loc === 'error' ? L.denied : L.locate

  // h-full/w-full (không dùng absolute): maplibre-gl.css ép .maplibregl-map thành
  // position:relative, nên inset-0 sẽ cho height 0. Cho map chiếm 100% khung cha.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
      {/* Góc dưới phải, trên số phiên bản (App): chú giải (nếu có) rồi nút định vị — nút đứng yên
          khi chú giải thu / mở. */}
      <div className="absolute right-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-[5] flex flex-col items-end gap-2">
        {overlay}
        <button
          type="button"
          onClick={locate}
          aria-label={locLabel}
          title={locLabel}
          className={`flex size-11 items-center justify-center rounded-full bg-card/90 shadow-lg shadow-black/10 backdrop-blur outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-95 ${
            loc === 'active' ? 'text-brand' : loc === 'error' ? 'text-destructive' : 'text-foreground'
          }`}
        >
          <LocIcon className={`size-5 ${loc === 'waiting' ? 'animate-pulse text-brand' : ''}`} />
        </button>
      </div>
    </div>
  )
}
