import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Station } from '../data/types'
import type { StationIndex } from '../data/stations'
import { allSaved, pinGroupOf, type GroupBook, type StationGroup } from '../data/groups'
import { pinTipOffset, rasterizePin, type PinSpec } from './pins'

// Trung tâm VN (Đà Nẵng) làm mặc định khi chưa có vị trí người dùng.
const DEFAULT_CENTER: [number, number] = [108.2, 16.05]
// Positron = nền xám nhạt, tối giản, ít POI — tương đương HERE "lite.day" của app mobile,
// để ghim trạm nổi bật trên nền. (Các lựa chọn khác: liberty, bright.)
const STYLE = 'https://tiles.openfreemap.org/styles/positron'

const SRC = 'stations'
const SRC_SELECTED = 'station-selected'

/** Ghim thường: trụ sạc trên đĩa xanh. */
const IMG_DEFAULT = 'pin-default'
/** Trạm đang chọn: tia sét trên đĩa xanh đậm, cỡ lớn hơn. */
const IMG_SELECTED = 'pin-selected'
const imgGroup = (id: string) => `pin-grp-${id}`

const PIN_GREEN = '#12B76A'
const PIN_SELECTED = '#0B6B3A'
/** Chiều rộng ghim, px CSS. Khớp PIN_DP / PIN_DP_BIG bên Android. */
const PIN_W = 34
const PIN_W_BIG = 44

interface Filters {
  favoritesOnly: boolean
}

function toGeoJSON(
  index: StationIndex,
  filters: Filters,
  book: GroupBook,
): GeoJSON.FeatureCollection {
  const saved = allSaved(book)
  const features: GeoJSON.Feature[] = []
  for (const st of index.all) {
    if (filters.favoritesOnly && !saved.has(st.entityId)) continue
    const grp = saved.has(st.entityId) ? (pinGroupOf(book, st.entityId) ?? '') : ''
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [st.lng, st.lat] },
      // grp = nhóm đại diện cho ghim; chuỗi rỗng = chưa lưu ở đâu.
      properties: { id: st.entityId, grp, rank: grp ? 1 : 0 },
    })
  }
  return { type: 'FeatureCollection', features }
}

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
    [IMG_DEFAULT, { colorHex: PIN_GREEN, glyph: 'charger' }, PIN_W],
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
  selected: Station | null
  flyTo: { lng: number; lat: number; zoom?: number } | null
  onSelect: (st: Station) => void
  onLocate?: (pos: { lat: number; lng: number }) => void
}

export function MapView({ index, filters, book, selected, flyTo, onSelect, onLocate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const loadedRef = useRef(false)
  // Giá trị mới nhất cho các handler đăng ký một lần trong lúc khởi tạo.
  const latest = useRef({ filters, book, selected, onSelect, onLocate })
  latest.current = { filters, book, selected, onSelect, onLocate }

  // Khởi tạo map một lần.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: DEFAULT_CENTER,
      zoom: 5,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    if (import.meta.env.DEV) (window as unknown as { __map: maplibregl.Map }).__map = map

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const geo = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true,
    })
    map.addControl(geo, 'top-right')
    geo.on('geolocate', (e: GeolocationPosition) => {
      latest.current.onLocate?.({ lat: e.coords.latitude, lng: e.coords.longitude })
    })

    map.on('load', () => {
      const { filters: f, book: b, selected: sel } = latest.current
      map.addSource(SRC, {
        type: 'geojson',
        data: toGeoJSON(index, f, b),
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 12,
      })
      map.addSource(SRC_SELECTED, { type: 'geojson', data: selectedGeoJSON(sel) })

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
        filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'id'], sel?.entityId ?? '']],
        layout: {
          'icon-image': [
            'case',
            ['!=', ['get', 'grp'], ''],
            ['concat', 'pin-grp-', ['get', 'grp']],
            IMG_DEFAULT,
          ],
          // Mũi ghim mới là toạ độ thật; neo đáy rồi bù lề đáy của ảnh để ghim "cắm" đúng chỗ.
          'icon-anchor': 'bottom',
          'icon-offset': [0, pinTipOffset(PIN_W)],
          // Trạm nằm sát nhau rất nhiều; để MapLibre tự giấu bớt thì bấm trạm nào trạm đó mất.
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'symbol-sort-key': ['get', 'rank'],
        },
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
      map.on('click', 'point', (e) => {
        const feat = e.features?.[0]
        if (!feat) return
        const st = index.byId.get(feat.properties?.id as string)
        if (st) latest.current.onSelect(st)
      })
      for (const layer of ['clusters', 'point']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
      }

      loadedRef.current = true
      void ensurePinImages(map, latest.current.book.groups)
      // Thử lấy vị trí người dùng ngay lần mở (mirror: mở app là về vị trí hiện tại).
      geo.trigger()
    })

    return () => {
      map.remove()
      mapRef.current = null
      loadedRef.current = false
    }
  }, [index])

  // Cập nhật dữ liệu khi filter / sổ nhóm đổi.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const src = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined
    src?.setData(toGeoJSON(index, filters, book))
  }, [index, filters, book])

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
      map.setFilter('point', [
        'all',
        ['!', ['has', 'point_count']],
        ['!=', ['get', 'id'], selected?.entityId ?? ''],
      ])
    }
  }, [selected])

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
