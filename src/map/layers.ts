/**
 * Nguồn, lớp, ảnh ghim và sự kiện của bản đồ — phần MapLibre thuần, tách khỏi component MapView
 * (vòng đời React). Mọi id nguồn/lớp nằm ở đây.
 */
import maplibregl from 'maplibre-gl'
import type { Station, StationPower } from '../data/types'
import { passesFilters, tierOf, type Filters, type StationIndex } from '../data/stations'
import { allSaved, pinGroupOf, type GroupBook, type StationGroup } from '../data/groups'
import type { GeoPoint } from '../lib/geo'
import { circleRing, destination } from '../data/range'
import { TIER_COLORS, pinTipOffset, rasterizePin, type PinSpec } from './pins'

export const SRC = 'stations'
export const SRC_SELECTED = 'station-selected'
/** Chế độ hành trình: tuyến + chỉ trạm dọc tuyến, KHÔNG gom cụm (≤ 400 điểm, gom sẽ giấu trạm). */
const SRC_TRIP = 'stations-trip'
const SRC_ROUTE = 'trip-route'
/** Tuyến phụ (HERE gợi ý thêm): xám, nằm dưới tuyến chính, chạm để chọn. */
const SRC_ALT = 'trip-alt'
/** Vòng tầm pin (đi tới được / đi về được) quanh vị trí người dùng. */
const SRC_RANGE = 'battery-range'
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

export function toGeoJSON(
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
export function applyTrip(
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

export const notSelected = (id: string): maplibregl.ExpressionSpecification => ['!=', ['get', 'id'], id]
/** Lọc lớp `point`: điểm lẻ (không phải cụm), trừ trạm đang chọn (vẽ ở lớp riêng). */
export const pointFilter = (selectedId: string): maplibregl.FilterSpecification => ['all', ['!', ['has', 'point_count']], notSelected(selectedId)]

export function selectedGeoJSON(st: Station | null): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: st
      ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [st.lng, st.lat] }, properties: { id: st.entityId } }]
      : [],
  }
}

/** Nạp ảnh ghim còn thiếu vào style. Ảnh đã có thì bỏ qua — gọi lại thoải mái. */
export async function ensurePinImages(map: maplibregl.Map, groups: StationGroup[]) {
  const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1))
  addRangeChip(map, ratio)
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

/** Nền chip cho nhãn km của vòng tầm pin. */
const IMG_RANGE_CHIP = 'range-chip'

/**
 * Viên thuốc bo tròn màu brand, co giãn theo chữ (`icon-text-fit`): chỉ kéo dãn phần giữa, giữ
 * nguyên hai đầu bo. Vẽ bằng canvas — đồng bộ, không phải chờ như ảnh ghim SVG.
 */
function addRangeChip(map: maplibregl.Map, ratio: number) {
  if (map.hasImage(IMG_RANGE_CHIP)) return
  const r = 10 // bán kính bo, px CSS
  const w = 2 * r + 4
  const h = 2 * r + 2
  const canvas = document.createElement('canvas')
  canvas.width = w * ratio
  canvas.height = h * ratio
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(ratio, ratio)
  ctx.fillStyle = ROUTE_COLOR
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, r)
  ctx.fill()
  const px = (v: number) => v * ratio
  map.addImage(IMG_RANGE_CHIP, ctx.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: ratio,
    stretchX: [[px(r), px(w - r)]],
    stretchY: [[px(r), px(h - r)]],
    content: [px(r), px(2), px(w - r), px(h - 2)],
  })
}

/** Nguồn của app (không thuộc style nền) — mang sang khi đổi nền sáng/tối. */
export const OWN_SOURCES = new Set([SRC, SRC_SELECTED, SRC_TRIP, SRC_ROUTE, SRC_ALT, SRC_RANGE])

/** Vòng tầm pin: tâm + bán kính chim bay (km) + nhãn đặt ở đáy phía nam mỗi vòng. */
export interface RangeLayer {
  center: { lat: number; lng: number }
  rings: Array<{ km: number; label: string; kind: 'one-way' | 'round-trip' }>
}

export function rangeGeoJSON(r: RangeLayer | null): GeoJSON.FeatureCollection {
  if (!r) return { type: 'FeatureCollection', features: [] }
  const features: GeoJSON.Feature[] = []
  for (const ring of r.rings) {
    if (!(ring.km > 0)) continue
    features.push({
      type: 'Feature',
      properties: { kind: ring.kind },
      geometry: { type: 'Polygon', coordinates: [circleRing(r.center, ring.km)] },
    })
    features.push({
      type: 'Feature',
      properties: { kind: ring.kind, label: ring.label },
      // Nhãn ở đáy phía nam: phía bắc hay bị ô tìm kiếm / thẻ tầm pin che.
      geometry: { type: 'Point', coordinates: destination(r.center, ring.km, 180) },
    })
  }
  return { type: 'FeatureCollection', features }
}

/** Khung bao vòng ngoài cùng — bay camera cho vừa khi bật tầm pin. */
export function rangeBounds(r: RangeLayer): [[number, number], [number, number]] | null {
  const km = Math.max(0, ...r.rings.map((x) => x.km))
  if (!(km > 0)) return null
  const [, n] = destination(r.center, km, 0)
  const [e] = destination(r.center, km, 90)
  const [, s] = destination(r.center, km, 180)
  const [w] = destination(r.center, km, 270)
  return [[w, s], [e, n]]
}

const CLUSTER_OPACITY = 0.85
/** Ghim / cụm ngoài vòng "đi tới được" vẽ mờ tới mức này. */
const OUT_OF_RANGE_OPACITY = 0.25

/**
 * Đặt dữ liệu vòng tầm pin (null = ẩn) và làm mờ ghim / cụm NGOÀI vòng "đi tới được" bằng biểu thức
 * `within` — tính trên GPU theo từng điểm, không phải dựng lại 25k feature khi kéo % pin.
 */
export function setRange(map: maplibregl.Map, r: RangeLayer | null) {
  ;(map.getSource(SRC_RANGE) as maplibregl.GeoJSONSource | undefined)?.setData(rangeGeoJSON(r))
  const ring = r?.rings.find((x) => x.kind === 'one-way' && x.km > 0)
  const inside: maplibregl.ExpressionSpecification | null = r && ring
    ? ['within', { type: 'Polygon', coordinates: [circleRing(r.center, ring.km)] }]
    : null
  // Trạm đang chọn (lớp riêng) luôn rõ.
  const pointBase = POINT_PAINT!['icon-opacity'] as maplibregl.ExpressionSpecification
  if (map.getLayer('point')) {
    map.setPaintProperty('point', 'icon-opacity', inside ? ['case', inside, pointBase, OUT_OF_RANGE_OPACITY] : pointBase)
  }
  if (map.getLayer('clusters')) {
    map.setPaintProperty('clusters', 'circle-opacity', inside ? ['case', inside, CLUSTER_OPACITY, OUT_OF_RANGE_OPACITY] : CLUSTER_OPACITY)
  }
  if (map.getLayer('cluster-count')) {
    map.setPaintProperty('cluster-count', 'text-opacity', inside ? ['case', inside, 1, 0.5] : 1)
  }
}

/** Thêm mọi nguồn + lớp của app vào style vừa nạp. Thứ tự thêm = thứ tự vẽ (sau đè trước). */
export function addAppLayers(map: maplibregl.Map, stations: GeoJSON.FeatureCollection, sel: Station | null) {
  map.addSource(SRC, {
    type: 'geojson',
    data: stations,
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: 12,
  })
  map.addSource(SRC_SELECTED, { type: 'geojson', data: selectedGeoJSON(sel) })
  map.addSource(SRC_TRIP, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource(SRC_ROUTE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource(SRC_ALT, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource(SRC_RANGE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

  // Tầm pin: dưới cùng trong các lớp của app. Vòng "đi tới được" tô nhạt + viền liền; vòng "đi về
  // được" chỉ viền đứt. Nhãn km ở đáy phía nam mỗi vòng.
  addRangeChip(map, Math.max(1, Math.min(3, window.devicePixelRatio || 1)))
  const polys: maplibregl.FilterSpecification = ['==', ['geometry-type'], 'Polygon']
  map.addLayer({
    id: 'range-fill',
    type: 'fill',
    source: SRC_RANGE,
    filter: ['all', polys, ['==', ['get', 'kind'], 'one-way']],
    paint: { 'fill-color': ROUTE_COLOR, 'fill-opacity': 0.07 },
  })
  // line-dasharray không theo dữ liệu được — hai lớp riêng cho viền liền / viền đứt.
  map.addLayer({
    id: 'range-line',
    type: 'line',
    source: SRC_RANGE,
    filter: ['all', polys, ['==', ['get', 'kind'], 'one-way']],
    paint: { 'line-color': ROUTE_COLOR, 'line-width': 2, 'line-opacity': 0.8 },
  })
  map.addLayer({
    id: 'range-line-round',
    type: 'line',
    source: SRC_RANGE,
    filter: ['all', polys, ['==', ['get', 'kind'], 'round-trip']],
    paint: { 'line-color': ROUTE_COLOR, 'line-width': 2, 'line-opacity': 0.8, 'line-dasharray': [2, 2] },
  })
  map.addLayer({
    id: 'range-label',
    type: 'symbol',
    source: SRC_RANGE,
    filter: ['==', ['geometry-type'], 'Point'],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'text-anchor': 'top',
      'text-offset': [0, 0.5],
      'text-allow-overlap': true,
      // Chữ nằm trong chip xanh (ảnh co giãn theo chữ): đọc được trên cả nền sáng lẫn tối.
      'icon-image': IMG_RANGE_CHIP,
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [3, 8, 3, 8],
      'icon-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff' },
  })

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
      'circle-opacity': CLUSTER_OPACITY,
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
    filter: pointFilter(sel?.entityId ?? ''),
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
  // Nhãn km của vòng tầm pin nằm trên cùng — không để cụm / ghim che mất.
  map.moveLayer('range-label')
}

/** Bấm cụm (phóng to), bấm ghim (mở trạm), chạm tuyến phụ (chọn tuyến), con trỏ tay khi rê. */
export function bindLayerEvents(map: maplibregl.Map, on: { select: (id: string) => void; pickRoute: (idx: number) => void }) {
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
      on.select(feat.properties?.id as string)
    })
  }
  map.on('click', 'trip-alt-hit', (e) => {
    // Chạm vào ghim trạm nằm trên đường xám là mở trạm, không đổi tuyến.
    if (map.queryRenderedFeatures(e.point, { layers: ['trip-point', 'point-selected'] }).length) return
    const idx = Number(e.features?.[0]?.properties?.idx)
    if (Number.isInteger(idx)) on.pickRoute(idx)
  })
  for (const layer of ['clusters', 'point', 'trip-point', 'trip-alt-hit']) {
    map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
  }
}
