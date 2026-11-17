import type { DataBundle, DataManifest, Station, StationPower, StationStatus } from './types'
import { pick } from '../i18n'
import { parsePowerGroups, type PowerRow } from './format'
import { foldText } from '../lib/text'
import { distanceKm, kmPerLng, KM_PER_LAT } from '../lib/geo'
import { HttpError, fetchJson } from '../lib/http'

export const CELL_SIZE = 0.1

/** Mã ô lưới ~11 km. Khớp với cellOf() trong Station.kt. */
export function cellOf(lat: number, lng: number): number {
  const la = Math.floor(lat / CELL_SIZE)
  const ln = Math.floor(lng / CELL_SIZE)
  return (la + 1000) * 100_000 + (ln + 2000)
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

const LOAD_FAILED = pick({
  vi: (path: string, status: number) => `Tải ${path} thất bại: ${status}`,
  en: (path: string, status: number) => `Failed to load ${path}: ${status}`,
})

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await fetchJson<T>(`${DATA_BASE}/${path}`, init)
  } catch (e) {
    if (e instanceof HttpError) throw e.status ? new Error(LOAD_FAILED(path, e.status)) : e.cause
    throw e
  }
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
    const r = bundle.rows[i] as PowerRow | null
    if (!r) continue
    out.set(index.all[i].entityId, {
      portCount: r[0],
      maxKw: r[1],
      dcCount: r[2],
      groups: parsePowerGroups(r[3]),
    })
  }
  return out
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

/**
 * Các trạm gần một điểm, sắp xếp theo khoảng cách tăng dần. Quét rộng dần theo vòng ô lưới
 * (~11 km/vòng) cho tới khi đủ `limit` trạm qua `predicate`, tối đa `maxRing` vòng.
 */
export function nearestStations(
  index: StationIndex,
  lat: number,
  lng: number,
  limit = 20,
  predicate: (st: Station) => boolean = () => true,
  maxRing = 10,
): Array<Station & { distanceKm: number }> {
  for (let ring = 1; ring <= maxRing; ring++) {
    const deg = ring * CELL_SIZE
    const sorted = stationsInBounds(index, lng - deg, lat - deg, lng + deg, lat + deg)
      .filter(predicate)
      .map((st) => ({ ...st, distanceKm: distanceKm(lat, lng, st.lat, st.lng) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
    // Đủ số lượng CHƯA đủ: trạm ở góc hình vuông có thể xa hơn trạm ngoài vòng. Chỉ dừng khi
    // trạm thứ `limit` nằm trong vòng tròn nội tiếp. Hình vuông tính theo độ nên cạnh đông-tây
    // chỉ dài 111·cos(lat) km/độ — lấy cạnh ngắn hơn làm bán kính.
    const innerKm = deg * Math.min(KM_PER_LAT, kmPerLng(lat))
    if ((sorted.length >= limit && sorted[limit - 1].distanceKm <= innerKm) || ring === maxRing) {
      return sorted.slice(0, limit)
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

export const STATUS_LABEL: Record<Exclude<StatusKind, 'active'>, string> = pick({
  vi: {
    busy: 'Đang hết cổng trống',
    maintaining: 'Đang bảo trì',
    out: 'Ngừng hoạt động',
    planned: 'Sắp khai trương',
  },
  en: {
    busy: 'All ports busy',
    maintaining: 'Under maintenance',
    out: 'Out of service',
    planned: 'Opening soon',
  },
})

/** `depot_status` của chi tiết (live, khi mở trạm) đè bản build ngày. */
export function statusOf(st: Station, depotStatus?: string | null): StatusKind {
  return (depotStatus && Object.hasOwn(FROM_DEPOT, depotStatus) && FROM_DEPOT[depotStatus]) || FROM_BASE[st.status]
}

/** Mốc "siêu nhanh": dữ liệu My Maps có 120 kW ~2.300 trạm, 150–250 kW ~780 trạm. */
export const FAST_KW = 120

/** 0 = AC hoặc chưa có dữ liệu, 1 = DC dưới 120 kW, 2 = DC từ 120 kW. */
export type PowerTier = 0 | 1 | 2

/** Cổng DC mạnh nhất (kW); 0 = không có DC / chưa có dữ liệu. */
export function dcMaxKw(p: StationPower | undefined): number {
  return p ? p.groups.reduce((m, g) => (g.dc ? Math.max(m, g.kw) : m), 0) : 0
}

/** Theo cổng DC mạnh nhất, không theo maxKw chung (AC 11 kW + DC 60 kW là tier 1). */
export function tierOf(p: StationPower | undefined): PowerTier {
  if (!p || p.dcCount === 0) return 0
  return dcMaxKw(p) >= FAST_KW ? 2 : 1
}

/** Mức lọc công suất theo cổng mạnh nhất (AC lẫn DC): ≥ 120 / 60–119 / dưới 60 kW. */
export type KwBand = 'hi' | 'mid' | 'low'
export const KW_BANDS: KwBand[] = ['hi', 'mid', 'low']
export const MID_KW = 60

export const KW_BAND_LABEL: Record<KwBand, string> = {
  hi: `≥ ${FAST_KW} kW`,
  mid: `${MID_KW}–${FAST_KW - 1} kW`,
  low: pick({ vi: `Dưới ${MID_KW} kW`, en: `Under ${MID_KW} kW` }),
}

export function bandOf(p: StationPower | undefined): KwBand | null {
  const max = p ? p.groups.reduce((m, g) => Math.max(m, g.kw), p.maxKw || 0) : 0
  if (max <= 0) return null
  return max >= FAST_KW ? 'hi' : max >= MID_KW ? 'mid' : 'low'
}

/** Rỗng hoặc đủ cả 3 mức = không lọc công suất. */
export const kwActive = (bands: KwBand[]) => bands.length > 0 && bands.length < KW_BANDS.length

/** Nhãn gọn cho chip / mô tả: các mức liền nhau gộp thành một khoảng. */
export function kwLabel(bands: KwBand[]): string {
  const has = (b: KwBand) => bands.includes(b)
  if (!kwActive(bands)) return pick({ vi: 'Công suất', en: 'Power' })
  if (has('hi') && has('mid')) return `≥ ${MID_KW} kW`
  if (has('mid') && has('low')) return `< ${FAST_KW} kW`
  if (has('hi') && has('low')) return `≥ ${FAST_KW} · < ${MID_KW} kW`
  if (has('hi')) return `≥ ${FAST_KW} kW`
  if (has('mid')) return `${MID_KW}–${FAST_KW - 1} kW`
  return `< ${MID_KW} kW`
}

export interface Filters {
  favoritesOnly: boolean
  activeOnly: boolean
  /** Mức công suất được hiện; xem kwActive. Đang lọc thì trạm chưa có dữ liệu power bị ẩn. */
  kw: KwBand[]
}

export const DEFAULT_FILTERS: Filters = { favoritesOnly: false, activeOnly: false, kw: [] }

/** Lọc chung cho bản đồ và bảng "Gần tôi". `saved` chỉ cần khi favoritesOnly. */
export function passesFilters(
  st: Station,
  f: Filters,
  power: Map<string, StationPower> | null,
  saved?: Set<string>,
): boolean {
  if (f.favoritesOnly && !saved?.has(st.entityId)) return false
  if (f.activeOnly && st.status !== 0) return false
  if (kwActive(f.kw)) {
    const b = bandOf(power?.get(st.entityId))
    if (!b || !f.kw.includes(b)) return false
  }
  return true
}
