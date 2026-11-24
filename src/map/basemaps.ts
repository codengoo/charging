/**
 * Lớp nền bản đồ: Mặc định (OpenFreeMap positron / dark theo giao diện), Đường phố (OpenFreeMap liberty —
 * nhiều màu, có POI, không có bản tối) và Vệ tinh (ảnh Esri World Imagery + nhãn đường / địa danh lấy từ
 * positron, chữ trắng viền tối). Lớp của app (ghim, tuyến, tầm pin) MapView mang sang khi đổi nền.
 */
import type { StyleSpecification } from 'maplibre-gl'

export type MapLayerId = 'default' | 'streets' | 'satellite'
export const MAP_LAYERS: MapLayerId[] = ['default', 'streets', 'satellite']

const OFM = 'https://tiles.openfreemap.org/styles'
export const STYLE_URL = {
  light: `${OFM}/positron`,
  dark: `${OFM}/dark`,
  streets: `${OFM}/liberty`,
} as const

/**
 * Ảnh vệ tinh Esri. Có key ArcGIS Location Platform (`VITE_ARCGIS_KEY` lúc build) thì dùng endpoint có key
 * theo điều khoản; chưa có thì dùng URL công khai (nên lấy key trước khi có nhiều người dùng).
 */
const ARCGIS_KEY = (import.meta.env.VITE_ARCGIS_KEY as string | undefined)?.trim() || ''
export const SATELLITE_TILES = ARCGIS_KEY
  ? `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(ARCGIS_KEY)}`
  : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
export const SATELLITE_ATTRIBUTION = 'Ảnh vệ tinh © Esri, Maxar, Earthstar Geographics'

/** Nhóm nhãn của style OpenMapTiles giữ lại trên ảnh vệ tinh: địa danh, tên đường, tên sông hồ. */
const LABEL_SOURCE_LAYERS = new Set(['place', 'transportation_name', 'water_name'])

/**
 * Style vệ tinh từ style positron đã tải: giữ sources / glyphs / sprite (lớp chữ của app cần glyphs),
 * thay mọi lớp nền bằng ảnh vệ tinh, chỉ giữ lớp NHÃN, đổi chữ trắng viền tối cho đọc được trên ảnh.
 */
export function satelliteStyle(base: StyleSpecification): StyleSpecification {
  const labels = base.layers
    .filter((l) => l.type === 'symbol' && 'source-layer' in l && LABEL_SOURCE_LAYERS.has(String(l['source-layer'])))
    .map((l) => ({
      ...l,
      paint: { ...(l.paint ?? {}), 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 1.5 },
    })) as StyleSpecification['layers']
  return {
    ...base,
    sources: {
      ...base.sources,
      satellite: { type: 'raster', tiles: [SATELLITE_TILES], tileSize: 256, maxzoom: 19, attribution: SATELLITE_ATTRIBUTION },
    },
    layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }, ...labels],
  }
}

let positron: Promise<StyleSpecification> | null = null

/** Style (URL hoặc object) cho lớp nền + giao diện. Vệ tinh cần tải positron trước (nhớ lại sau lần đầu). */
export async function styleFor(layer: MapLayerId, theme: 'light' | 'dark'): Promise<string | StyleSpecification> {
  if (layer === 'streets') return STYLE_URL.streets
  if (layer === 'satellite') {
    positron ??= fetch(STYLE_URL.light).then((r) => {
      if (!r.ok) throw new Error(`style ${r.status}`)
      return r.json() as Promise<StyleSpecification>
    })
    try {
      return satelliteStyle(await positron)
    } catch {
      positron = null // mất mạng: lần sau thử lại; giờ dùng nền mặc định
      return STYLE_URL[theme]
    }
  }
  return STYLE_URL[theme]
}

/** Khoá so sánh: lớp Đường phố / Vệ tinh không đổi theo giao diện sáng / tối. */
export const styleKey = (layer: MapLayerId, theme: 'light' | 'dark') => (layer === 'default' ? `default-${theme}` : layer)
