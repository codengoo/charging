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
  /** Base v2 (chưa có cột) → 0. */
  status: StationStatus
}

/**
 * Trạng thái trạm theo bản build ngày (cột 9 của base). 0 hoạt động, 1 bảo trì, 2 ngừng hoạt
 * động, 3 chưa khai trương. "Hết cổng trống" không có ở đây — chỉ có realtime khi mở trạm.
 */
export type StationStatus = 0 | 1 | 2 | 3

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
 * Chi tiết một trạm từ `get-locator/<entityId>` của VinFast, qua Worker (`/api/station/<id>`).
 * Chỉ tải khi người dùng MỞ trạm — không có trong gói dữ liệu ngày.
 */
export interface StationDetail {
  /** Ảnh thật của trạm (S3 VinFast). */
  images: string[]
  /** Theo connector của VinFast; trạm thiếu connector thì 0 / rỗng — dùng My Maps thay. */
  portCount: number
  maxKw: number | null
  dcCount: number
  groups: PortGroup[]
  /** Chuẩn đầu sạc đã đổi sang tên quen: "CCS2", "Type 2", "CHAdeMO". */
  standards: string[]
  reservable: boolean
  open247: boolean
  /** Giờ mở cửa khi không 24/7, vd "06:00–22:00"; null = không rõ. */
  hours: string | null
  hotline: string | null
  /** `extra_data.depot_status`: Available | AllBusy | Maintaining | OutOfService. */
  depotStatus: string | null
  /** `last_updated` của trạm phía VinFast (ISO). */
  updatedAt: string | null
}

export type { DataBundle, DataManifest } from './format'
