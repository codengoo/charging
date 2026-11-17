import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Station, StationPower } from '../data/types'
import { distanceKm, passesFilters, tierOf, type Filters, type StationIndex } from '../data/stations'
import { allSaved, pinGroupOf, type GroupBook, type StationGroup } from '../data/groups'
import { TIER_COLORS, pinTipOffset, rasterizePin, type PinSpec } from './pins'
import type { GeoPoint } from '../lib/flexiblePolyline'

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

const SRC = 'stations'
const SRC_SELECTED = 'station-selected'
/** Chế độ hành trình: tuyến + chỉ trạm dọc tuyến, KHÔNG gom cụm (≤ 400 điểm, gom sẽ giấu trạm). */
const SRC_TRIP = 'stations-trip'
const SRC_ROUTE = 'trip-route'
/** Tuyến phụ (HERE gợi ý thêm): xám, nằm dưới tuyến chính, chạm để chọn. */
const SRC_ALT = 'trip-alt'
/** Các lớp của bản đồ thường, ẩn đi khi đang có tuyến. */
const NORMAL_LAYERS = ['clusters', 'cluster-count', 'point']
const ROUTE_COLOR = '#009966'
const ALT_COLOR = '#8a94a6'

/** Tuyến đang mở: đường vẽ, id trạm dọc tuyến, khung bay camera. */
export interface TripLayer {
  path: GeoPoint[]
  /** Tuyến phụ; `idx` = vị trí trong danh sách tuyến, trả lại qua `onPickRoute`. */
  alts: Array<{ idx: number; path: GeoPoint[] }>
  stationIds: Set<string>
  bounds: [[number, number], [number, number]] | null
  /** Chừa chỗ cho bảng hành trình khi fitBounds (px). */
  padding: { top: number; bottom: number; left: number; right: number }
}

/** Ghim thường: trụ sạc, màu theo mức công suất (TIER_COLORS). */
const IMG_DEFAULT = 'pin-default'
const IMG_DC = 'pin-dc'
const IMG_DC120 = 'pin-dc120'
/** Trạm đang chọn: tia sét trên đĩa xanh đậm, cỡ lớn hơn. */
const IMG_SELECTED = 'pin-selected'
const imgGroup = (id: string) => `pin-grp-${id}`

const PIN_SELECTED = '#0B6B3A'
/** Chiều rộng ghim, px CSS. Khớp PIN_DP / PIN_DP_BIG bên Android. */
const PIN_W = 34
const PIN_W_BIG = 44

function toGeoJSON(
  index: StationIndex,
  filters: Filters,
  book: GroupBook,
  power: Map<string, StationPower> | null,
): GeoJSON.FeatureCollection {
  const saved = allSaved(book)
  const features: GeoJSON.Feature[] = []
  for (const st of index.all) {
    if (passesFilters(st, filters, power, saved)) features.push(feature(st, book, saved, power))
  }
  return { type: 'FeatureCollection', features }
}

/** Ghim của trạm dọc tuyến — bỏ qua chip lọc, danh sách dọc đường đã tự lọc. */
function tripGeoJSON(
  index: StationIndex,
  ids: Set<string>,
  book: GroupBook,
  power: Map<string, StationPower> | null,
): GeoJSON.FeatureCollection {
  const saved = allSaved(book)
  const features: GeoJSON.Feature[] = []
  for (const id of ids) {
    const st = index.byId.get(id)
    if (st) features.push(feature(st, book, saved, power))
  }
  return { type: 'FeatureCollection', features }
}

function feature(
  st: Station,
  book: GroupBook,
  saved: Set<string>,
  power: Map<string, StationPower> | null,
): GeoJSON.Feature {
  const grp = saved.has(st.entityId) ? (pinGroupOf(book, st.entityId) ?? '') : ''
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [st.lng, st.lat] },
    // grp = nhóm đại diện cho ghim; chuỗi rỗng = chưa lưu ở đâu. st = trạng thái (0 hoạt động).
    // tier = mức công suất, quyết định màu ghim thường.
    properties: { id: st.entityId, grp, rank: grp ? 1 : 0, st: st.status, tier: tierOf(power?.get(st.entityId)) },
  }
}

function routeGeoJSON(path: GeoPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features:
      path.length > 1
        ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: path.map((p) => [p.lng, p.lat]) }, properties: {} }]
        : [],
  }
}

function altGeoJSON(alts: TripLayer['alts']): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: alts
      .filter((a) => a.path.length > 1)
      .map((a) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: a.path.map((p) => [p.lng, p.lat]) },
        properties: { idx: a.idx },
      })),
  }
}

/** Bật/tắt chế độ hành trình: đổi dữ liệu nguồn tuyến + ẩn/hiện lớp thường. */
function applyTrip(
  map: maplibregl.Map,
  trip: TripLayer | null,
  index: StationIndex,
  book: GroupBook,
  power: Map<string, StationPower> | null,
) {
  const on = !!trip && trip.path.length > 1
  ;(map.getSource(SRC_ROUTE) as maplibregl.GeoJSONSource | undefined)?.setData(routeGeoJSON(on ? trip.path : []))
  ;(map.getSource(SRC_ALT) as maplibregl.GeoJSONSource | undefined)?.setData(altGeoJSON(on ? trip.alts : []))
  ;(map.getSource(SRC_TRIP) as maplibregl.GeoJSONSource | undefined)?.setData(
    on ? tripGeoJSON(index, trip.stationIds, book, power) : { type: 'FeatureCollection', features: [] },
  )
  for (const id of NORMAL_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'none' : 'visible')
}

/** Ghim thường và ghim dọc tuyến dùng chung kiểu vẽ. */
const POINT_LAYOUT: maplibregl.SymbolLayerSpecification['layout'] = {
  'icon-image': [
    'case',
    ['!=', ['get', 'grp'], ''],
    ['concat', 'pin-grp-', ['get', 'grp']],
    ['match', ['get', 'tier'], 1, IMG_DC, 2, IMG_DC120, IMG_DEFAULT],
  ],
  // Mũi ghim mới là toạ độ thật; neo đáy rồi bù lề đáy của ảnh để ghim "cắm" đúng chỗ.
  'icon-anchor': 'bottom',
  'icon-offset': [0, pinTipOffset(PIN_W)],
  // Trạm nằm sát nhau rất nhiều; để MapLibre tự giấu bớt thì bấm trạm nào trạm đó mất.
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
  // Trạm không hoạt động vẽ dưới trạm thường; trạm đã lưu vẫn nổi nhất.
  'symbol-sort-key': ['-', ['get', 'rank'], ['case', ['==', ['get', 'st'], 0], 0, 2]],
}
const POINT_PAINT: maplibregl.SymbolLayerSpecification['paint'] = {
  // Bảo trì / ngừng / chưa khai trương: vẫn vẽ để biết có trạm, nhưng lùi ra sau.
  'icon-opacity': ['case', ['==', ['get', 'st'], 0], 1, 0.45],
}

const notSelected = (id: string): maplibregl.ExpressionSpecification => ['!=', ['get', 'id'], id]

function selectedGeoJSON(st: Station | null): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: st
      ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [st.lng, st.lat] }, properties: { id: st.entityId } }]
      : [],
  }
}

/** Nạp ảnh ghim còn thiếu vào style. Ảnh đã có thì bỏ qua — gọi lại thoải mái. */
async function ensurePinImages(map: maplibregl.Map, groups: StationGroup[]) {
  const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1))
  const wanted: Array<[string, PinSpec, number]> = [
    [IMG_DEFAULT, { colorHex: TIER_COLORS[0], glyph: 'charger' }, PIN_W],
    [IMG_DC, { colorHex: TIER_COLORS[1], glyph: 'charger' }, PIN_W],
    [IMG_DC120, { colorHex: TIER_COLORS[2], glyph: 'charger' }, PIN_W],
    [IMG_SELECTED, { colorHex: PIN_SELECTED, glyph: 'selected' }, PIN_W_BIG],
    ...groups.map(
      (g) => [imgGroup(g.id), { colorHex: g.colorHex, glyph: g.iconKey }, PIN_W] as [string, PinSpec, number],
    ),
  ]
  await Promise.all(
    wanted
      .filter(([name]) => !map.hasImage(name))
      .map(async ([name, spec, w]) => {
        const data = await rasterizePin(spec, w, ratio)
        // Map có thể đã bị huỷ hoặc ảnh đã được nạp bởi lần gọi song song.
        if (!map.getStyle() || map.hasImage(name)) return
        map.addImage(name, data, { pixelRatio: ratio })
      }),
  )
}

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
}

/** Nguồn của app (không thuộc style nền) — mang sang khi đổi nền sáng/tối. */
const OWN_SOURCES = new Set([SRC, SRC_SELECTED, SRC_TRIP, SRC_ROUTE, SRC_ALT])

export function MapView({ index, filters, book, power, selected, flyTo, onSelect, onLocate, onMoveEnd, trip = null, onPickRoute, theme = 'light' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const loadedRef = useRef(false)
  // Giá trị mới nhất cho các handler đăng ký một lần trong lúc khởi tạo.
  const latest = useRef({ index, filters, book, power, selected, onSelect, onLocate, onMoveEnd, trip, onPickRoute })
  latest.current = { index, filters, book, power, selected, onSelect, onLocate, onMoveEnd, trip, onPickRoute }

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

    map.on('moveend', () => {
      const c = map.getCenter()
      latest.current.onMoveEnd?.({ lat: c.lat, lng: c.lng, zoom: map.getZoom() })
    })

    map.on('load', () => {
      const { index: idx, filters: f, book: b, power: p, selected: sel } = latest.current
      map.addSource(SRC, {
        type: 'geojson',
        data: toGeoJSON(idx, f, b, p),
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 12,
      })
      map.addSource(SRC_SELECTED, { type: 'geojson', data: selectedGeoJSON(sel) })
      map.addSource(SRC_TRIP, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addSource(SRC_ROUTE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addSource(SRC_ALT, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

      // Tuyến phụ: xám, dưới tuyến chính. Lớp `trip-alt-hit` trong suốt và rộng để chạm trúng trên điện thoại.
      map.addLayer({
        id: 'trip-alt-casing',
        type: 'line',
        source: SRC_ALT,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 },
      })
      map.addLayer({
        id: 'trip-alt-line',
        type: 'line',
        source: SRC_ALT,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': ALT_COLOR, 'line-width': 4, 'line-opacity': 0.9 },
      })
      map.addLayer({
        id: 'trip-alt-hit',
        type: 'line',
        source: SRC_ALT,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#000000', 'line-width': 24, 'line-opacity': 0 },
      })

      // Tuyến hành trình: viền trắng + lõi màu brand, nằm DƯỚI mọi ghim.
      map.addLayer({
        id: 'trip-line-casing',
        type: 'line',
        source: SRC_ROUTE,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 },
      })
      map.addLayer({
        id: 'trip-line',
        type: 'line',
        source: SRC_ROUTE,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': ROUTE_COLOR, 'line-width': 5, 'line-opacity': 0.85 },
      })

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: SRC,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#0b7a47',
          'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 16, 50, 22, 500, 30],
        },
      })
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: SRC,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      })
      // Ghim trạm. Trạm đã lưu đeo hình + màu của nhóm đại diện; vẽ đè lên ghim thường.
      map.addLayer({
        id: 'point',
        type: 'symbol',
        source: SRC,
        filter: ['all', ['!', ['has', 'point_count']], notSelected(sel?.entityId ?? '')],
        layout: POINT_LAYOUT,
        paint: POINT_PAINT,
      })
      map.addLayer({
        id: 'trip-point',
        type: 'symbol',
        source: SRC_TRIP,
        filter: notSelected(sel?.entityId ?? ''),
        layout: POINT_LAYOUT,
        paint: POINT_PAINT,
      })
      // Trạm đang chọn: nguồn riêng một điểm để đổi chọn không phải dựng lại 24k feature.
      map.addLayer({
        id: 'point-selected',
        type: 'symbol',
        source: SRC_SELECTED,
        layout: {
          'icon-image': IMG_SELECTED,
          'icon-anchor': 'bottom',
          'icon-offset': [0, pinTipOffset(PIN_W_BIG)],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      })

      map.on('click', 'clusters', (e) => {
        const feat = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]
        const clusterId = feat.properties?.cluster_id
        const src = map.getSource(SRC) as maplibregl.GeoJSONSource
        src.getClusterExpansionZoom(clusterId).then((zoom) => {
          const geom = feat.geometry as GeoJSON.Point
          map.easeTo({ center: geom.coordinates as [number, number], zoom })
        })
      })
      for (const layer of ['point', 'trip-point']) {
        map.on('click', layer, (e) => {
          const feat = e.features?.[0]
          if (!feat) return
          const st = latest.current.index.byId.get(feat.properties?.id as string)
          if (st) latest.current.onSelect(st)
        })
      }
      map.on('click', 'trip-alt-hit', (e) => {
        // Chạm vào ghim trạm nằm trên đường xám là mở trạm, không đổi tuyến.
        if (map.queryRenderedFeatures(e.point, { layers: ['trip-point', 'point-selected'] }).length) return
        const idx = Number(e.features?.[0]?.properties?.idx)
        if (Number.isInteger(idx)) latest.current.onPickRoute?.(idx)
      })
      for (const layer of ['clusters', 'point', 'trip-point', 'trip-alt-hit']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
      }

      loadedRef.current = true
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
      map.setFilter('point', ['all', ['!', ['has', 'point_count']], notSelected(selected?.entityId ?? '')])
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
