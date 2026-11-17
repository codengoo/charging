import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
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
  selectedGeoJSON,
  toGeoJSON,
  type TripLayer,
} from './layers'

export type { TripLayer } from './layers'

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
}

/** Giữ ngón tay chừng này (ms) không di chuyển quá LONG_PRESS_SLOP px thì coi là chạm giữ. */
const LONG_PRESS_MS = 550
const LONG_PRESS_SLOP = 10

export function MapView({ index, filters, book, power, selected, flyTo, onSelect, onLocate, onMoveEnd, trip = null, onPickRoute, theme = 'light', places = [], onPlaceClick, onLongPress, pinAt = null, onMapClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const loadedRef = useRef(false)
  // Giá trị mới nhất cho các handler đăng ký một lần trong lúc khởi tạo.
  const latest = useRef({ index, filters, book, power, selected, onSelect, onLocate, onMoveEnd, trip, onPickRoute, onPlaceClick, onLongPress, onMapClick })
  latest.current = { index, filters, book, power, selected, onSelect, onLocate, onMoveEnd, trip, onPickRoute, onPlaceClick, onLongPress, onMapClick }
  const placeMarkers = useRef<ReturnType<typeof createPlaceMarkers> | null>(null)
  const pinMarker = useRef<maplibregl.Marker | null>(null)

  // Khởi tạo map một lần.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLES[theme],
      center: DEFAULT_CENTER,
      zoom: 5,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    if (import.meta.env.DEV) (window as unknown as { __map: maplibregl.Map }).__map = map

    const geo = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true,
    })
    map.addControl(geo, 'top-right')
    // Không hiện nút (zoom bằng ngón tay / con lăn là đủ): control vẫn cần để vẽ chấm vị trí,
    // tự bay về chỗ người dùng lúc mở và báo onLocate. Góc trên phải chỉ có control này.
    const corner = map.getContainer().querySelector<HTMLElement>('.maplibregl-ctrl-top-right')
    if (corner) corner.style.display = 'none'
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
      if (g._watchState === 'WAITING_ACTIVE') g._watchState = 'BACKGROUND'
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
      void ensurePinImages(map, latest.current.book.groups)
      // Thử lấy vị trí người dùng ngay lần mở (mirror: mở app là về vị trí hiện tại).
      geo.trigger()
    })

    return () => {
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

  // h-full/w-full (không dùng absolute): maplibre-gl.css ép .maplibregl-map thành
  // position:relative, nên inset-0 sẽ cho height 0. Cho map chiếm 100% khung cha.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
