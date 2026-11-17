/**
 * Định dạng file dữ liệu builder (`builder/lib/build.mjs`, `builder/run-local.mjs`) ghi lên R2 —
 * MỘT chỗ khai báo cho builder (JSDoc `import()`), Worker và client. Đổi thứ tự cột ở đây thì
 * phải đổi cả builder lẫn chỗ đọc (`stations.ts`, `worker/index.ts`).
 */
import type { PortGroup } from './types'

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
  /** Shard tra cứu cho preview link /station/* (chỉ Worker dùng). */
  seo?: { dir: string; shards: number }
}

/**
 * Khoá phiên bản dữ liệu. Tên file mang generation VÀ hash nội dung (`power-<gen>-<hash8>.json`)
 * — chỉ My Maps đổi trong ngày thì generation giữ nguyên nhưng tên file đổi. Manifest cũ (chưa có
 * hash) vẫn so được vì so cả chuỗi tên.
 */
export const dataKey = (m: Pick<DataManifest, 'base' | 'power'>): string => `${m.base}|${m.power}`

/** `base-<gen>-<hash>.json` / `power-<gen>-<hash>.json`: hàng packed theo `fields`. */
export interface DataBundle {
  v: number
  generation: number
  builtAt: string
  fields: string[]
  rows: unknown[][]
}

/** Cột của `base` (v3). */
export const BASE_FIELDS = ['id', 'storeId', 'name', 'address', 'lat', 'lng', 'flags', 'availableDate', 'status'] as const
/** Cột của `power` (v2). Hàng null = trạm chưa có dữ liệu cổng. */
export const POWER_FIELDS = ['portCount', 'maxKw', 'dcCount', 'groups'] as const

/** Một hàng `power`: [portCount, maxKw, dcCount, "kw:count:dc|…"]. */
export type PowerRow = [number, number, number, string]

/** Một mục shard `seo-<gen>/<id % shards>.json`: [name, address, flags]. */
export type SeoRow = [string, string, number]

/** "250:2:1|60:4:1" -> [{kw:250,count:2,dc:true}, …] (builder đã sắp kW giảm dần). */
export function parsePowerGroups(s: string): PortGroup[] {
  if (!s) return []
  return s.split('|').flatMap((part) => {
    const [kw, count, dc] = part.split(':').map(Number)
    return Number.isFinite(kw) && Number.isFinite(count) ? [{ kw, count, dc: dc === 1 }] : []
  })
}
