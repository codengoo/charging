// Manifest dữ liệu + tra shard SEO trong R2 — dùng cho trang /station/* và kiểm trạm tồn tại
// khi ghi đánh giá.
import type { DataManifest, SeoRow } from '../src/data/format'
import { readR2Json } from './http'

/** Manifest đổi một lần mỗi ngày; giữ theo isolate 60 s để mỗi trang trạm không tốn thêm một lượt đọc R2. */
const MANIFEST_TTL_MS = 60_000
let cached: { at: number; value: DataManifest | null } | null = null

export async function getManifest(data: R2Bucket): Promise<DataManifest | null> {
  if (cached && Date.now() - cached.at < MANIFEST_TTL_MS) return cached.value
  const value = await readR2Json<DataManifest>(data, 'manifest.json')
  cached = { at: Date.now(), value }
  return value
}

/**
 * Tra một trạm trong shard `seo-<gen>/<id % shards>.json` (~100 KB) — parse cả base 4 MB vượt hạn
 * CPU Free plan. `noIndex` = manifest/shard chưa có (bản build cũ, R2 local trống): không biết
 * trạm có hay không.
 */
export async function lookupSeoRow(data: R2Bucket, id: string): Promise<{ row: SeoRow | null; noIndex: boolean }> {
  const seo = (await getManifest(data))?.seo
  if (!seo) return { row: null, noIndex: true }
  const shard = await readR2Json<Record<string, SeoRow>>(data, `${seo.dir}/${Number(id) % seo.shards}.json`)
  if (!shard) return { row: null, noIndex: true }
  return { row: shard[id] ?? null, noIndex: false }
}
