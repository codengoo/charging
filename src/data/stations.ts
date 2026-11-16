import type { DataBundle, DataManifest, PortGroup, Station, StationPower, StationStatus } from './types'

const CELL_SIZE = 0.1

/** Mã ô lưới ~11 km. Khớp với cellOf() trong Station.kt. */
export function cellOf(lat: number, lng: number): number {
  const la = Math.floor(lat / CELL_SIZE)
  const ln = Math.floor(lng / CELL_SIZE)
  return (la + 1000) * 100_000 + (ln + 2000)
}

/** Hạ dấu tiếng Việt để tìm kiếm không phân biệt dấu. Port searchKeyOf / TextFold. */
export function foldText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu tổ hợp
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Giải mã một dòng packed [id,storeId,name,address,lat,lng,flags,availableDate,status]. */
function parseRow(r: unknown[]): Station {
  const lat = r[4] as number
  const lng = r[5] as number
  const flags = r[6] as number
  const name = r[2] as string
  const address = r[3] as string
  const available = r[7]
  const status = r[8]
  return {
    entityId: r[0] as string,
    storeId: r[1] as string,
    name,
    address,
    lat,
    lng,
    cell: cellOf(lat, lng),
    searchKey: foldText(name + ' ' + address),
    isPublic: (flags & 1) !== 0,
    parkingFee: (flags & 2) !== 0,
    hasLink: (flags & 4) !== 0,
    // Builder ghi 0 khi không có ngày.
    availableDate: typeof available === 'string' && available ? available : null,
    // Base v2 chưa có cột này; mã lạ cũng coi như hoạt động.
    status: status === 1 || status === 2 || status === 3 ? status : 0,
  }
}

export interface StationIndex {
  all: Station[]
  byId: Map<string, Station>
  byCell: Map<number, Station[]>
  generation: number
  builtAt: string
  manifest: DataManifest
}

/** Gốc dữ liệu: Worker đọc R2 tại `/data/*` (ở dev, vite phục vụ từ builder/out — xem vite.config.ts). */
const DATA_BASE = '/data'

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${DATA_BASE}/${path}`, init)
  if (!res.ok) throw new Error(`Tải ${path} thất bại: ${res.status}`)
  return (await res.json()) as T
}

/**
 * Con trỏ bản mới nhất. `no-cache` = luôn hỏi lại server (ETag nên thường chỉ tốn 304) —
 * builder làm mới mỗi ngày, không được dùng manifest cũ trong cache trình duyệt.
 */
export function loadManifest(): Promise<DataManifest> {
  return getJson<DataManifest>('manifest.json', { cache: 'no-cache' })
}

/** Tải dữ liệu trạm của một generation và dựng chỉ mục theo id + ô lưới. */
export async function loadStations(manifest?: DataManifest): Promise<StationIndex> {
  const m = manifest ?? (await loadManifest())
  // Tên file mang generation → cache vĩnh viễn, đổi gen tự cache-bust.
  const bundle = await getJson<DataBundle>(m.base)

  const all: Station[] = new Array(bundle.rows.length)
  const byId = new Map<string, Station>()
  const byCell = new Map<number, Station[]>()
  for (let i = 0; i < bundle.rows.length; i++) {
    const st = parseRow(bundle.rows[i])
    all[i] = st
    byId.set(st.entityId, st)
    const bucket = byCell.get(st.cell)
    if (bucket) bucket.push(st)
    else byCell.set(st.cell, [st])
  }
  return { all, byId, byCell, generation: m.generation, builtAt: m.builtAt, manifest: m }
}

/**
 * Số cổng + công suất, căn theo THỨ TỰ hàng của base cùng generation (không mang id).
 * Hàng `null` = chưa có dữ liệu cho trạm đó.
 */
export async function loadPower(index: StationIndex): Promise<Map<string, StationPower>> {
  const bundle = await getJson<DataBundle>(index.manifest.power)
  const out = new Map<string, StationPower>()
  const n = Math.min(bundle.rows.length, index.all.length)
  for (let i = 0; i < n; i++) {
    const r = bundle.rows[i] as [number, number, number, string] | null
    if (!r) continue
    out.set(index.all[i].entityId, {
      portCount: r[0],
      maxKw: r[1],
      dcCount: r[2],
      groups: parseGroups(r[3]),
    })
  }
  return out
}

/** "250:2:1|60:4:1" -> [{kw:250,count:2,dc:true}, …] (builder đã sắp kW giảm dần). */
function parseGroups(s: string): PortGroup[] {
  if (!s) return []
  return s.split('|').flatMap((part) => {
    const [kw, count, dc] = part.split(':').map(Number)
    return Number.isFinite(kw) && Number.isFinite(count) ? [{ kw, count, dc: dc === 1 }] : []
  })
}

/** Lấy các trạm trong khung nhìn (theo các ô lưới phủ bbox). */
export function stationsInBounds(
  index: StationIndex,
  west: number,
  south: number,
  east: number,
  north: number,
): Station[] {
  const out: Station[] = []
  const laMin = Math.floor(south / CELL_SIZE)
  const laMax = Math.floor(north / CELL_SIZE)
  const lnMin = Math.floor(west / CELL_SIZE)
  const lnMax = Math.floor(east / CELL_SIZE)
  for (let la = laMin; la <= laMax; la++) {
    for (let ln = lnMin; ln <= lnMax; ln++) {
      const cell = (la + 1000) * 100_000 + (ln + 2000)
      const bucket = index.byCell.get(cell)
      if (bucket) for (const st of bucket) out.push(st)
    }
  }
  return out
}

/** Tìm kiếm theo tên/địa chỉ (đã hạ dấu), tối đa `limit` kết quả. */
export function searchStations(index: StationIndex, query: string, limit = 50): Station[] {
  const q = foldText(query)
  if (!q) return []
  const terms = q.split(' ')
  const out: Station[] = []
  for (const st of index.all) {
    if (terms.every((t) => st.searchKey.includes(t))) {
      out.push(st)
      if (out.length >= limit) break
    }
  }
  return out
}

/** Khoảng cách Haversine (km). */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const la1 = (aLat * Math.PI) / 180
  const la2 = (bLat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Các trạm gần một điểm, sắp xếp theo khoảng cách tăng dần. */
export function nearestStations(
  index: StationIndex,
  lat: number,
  lng: number,
  limit = 20,
): Array<Station & { distanceKm: number }> {
  // Quét rộng dần theo ô cho tới khi đủ ứng viên.
  for (let ring = 1; ring <= 10; ring++) {
    const deg = ring * CELL_SIZE
    const cand = stationsInBounds(index, lng - deg, lat - deg, lng + deg, lat + deg)
    if (cand.length >= limit || ring === 10) {
      return cand
        .map((st) => ({ ...st, distanceKm: distanceKm(lat, lng, st.lat, st.lng) }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, limit)
    }
  }
  return []
}

/** Trạng thái để hiển thị. `busy` chỉ có từ chi tiết live — base không giữ trạng thái này. */
export type StatusKind = 'active' | 'busy' | 'maintaining' | 'out' | 'planned'

const FROM_BASE: Record<StationStatus, StatusKind> = { 0: 'active', 1: 'maintaining', 2: 'out', 3: 'planned' }
const FROM_DEPOT: Record<string, StatusKind> = {
  Available: 'active',
  AllBusy: 'busy',
  Maintaining: 'maintaining',
  OutOfService: 'out',
  Planned: 'planned',
}

export const STATUS_LABEL: Record<Exclude<StatusKind, 'active'>, string> = {
  busy: 'Đang hết cổng trống',
  maintaining: 'Đang bảo trì',
  out: 'Ngừng hoạt động',
  planned: 'Sắp khai trương',
}

/** `depot_status` của chi tiết (live, khi mở trạm) đè bản build ngày. */
export function statusOf(st: Station, depotStatus?: string | null): StatusKind {
  return (depotStatus && Object.hasOwn(FROM_DEPOT, depotStatus) && FROM_DEPOT[depotStatus]) || FROM_BASE[st.status]
}
