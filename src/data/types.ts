/** Một trạm sạc ô tô (phần tĩnh — không bao giờ đổi). Port từ Station.kt. */
export interface Station {
  entityId: string
  storeId: string
  name: string
  address: string
  lat: number
  lng: number
  cell: number
  /** Tên + địa chỉ đã hạ dấu, chỉ dùng để tìm kiếm. */
  searchKey: string
  isPublic: boolean
  parkingFee: boolean
  hasLink: boolean
  availableDate: string | null
}

/** Một nhóm cổng cùng công suất: "250 kW × 2, DC". */
export interface PortGroup {
  kw: number
  count: number
  dc: boolean
}

/**
 * Số cổng + công suất của một trạm (enrich từ Google My Maps, ~89% trạm có). Tải SAU dữ liệu
 * trạm — bản đồ hiện ngay, chi tiết cổng có khi người dùng mở trạm.
 */
export interface StationPower {
  portCount: number
  maxKw: number
  dcCount: number
  groups: PortGroup[]
}

/**
 * Con trỏ "bản mới nhất" do builder (GitHub Action, chạy mỗi ngày) ghi lên R2, phục vụ ở
 * `/data/manifest.json`. Tên file base/power mang generation nên cache vĩnh viễn được.
 */
export interface DataManifest {
  generation: number
  builtAt: string
  base: string
  power: string
  counts: { stations: number; enriched: number }
}

/** `base-<gen>.json` / `power-<gen>.json`: hàng packed theo `fields`. */
export interface DataBundle {
  v: number
  generation: number
  builtAt: string
  fields: string[]
  rows: unknown[][]
}
