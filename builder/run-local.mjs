// Chạy pipeline ETL, ghi JSON thô ra builder/out/. Dùng cho GitHub Action (rồi upload R2)
// và để kiểm tra local. Chỉ cần Node (không npm dep).
//   node builder/run-local.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { buildData } from './lib/build.mjs'

const t0 = Date.now()
const { manifest, base, power } = await buildData((m) => console.log('·', m))

await mkdir(new URL('./out/', import.meta.url), { recursive: true })
const out = (name) => new URL(`./out/${name}`, import.meta.url)

// Shard tra cứu cho preview link /station/<id> (worker/index.ts): trạm chia theo id % SEO_SHARDS,
// mỗi file chỉ [name, address, flags]. Worker đọc MỘT shard (~130 KB) thay vì base 4 MB —
// parse cả base vượt hạn 10 ms CPU của Workers Free plan.
const SEO_SHARDS = 32
const seoDir = `seo-${manifest.generation}`
const shards = Array.from({ length: SEO_SHARDS }, () => ({}))
for (const r of base.rows) shards[Number(r[0]) % SEO_SHARDS][r[0]] = [r[2], r[3], r[6]]
await mkdir(out(`${seoDir}/`), { recursive: true })
await Promise.all(shards.map((sh, i) => writeFile(out(`${seoDir}/${i}.json`), JSON.stringify(sh))))
manifest.seo = { dir: seoDir, shards: SEO_SHARDS }

// Lưu JSON THÔ — Cloudflare tự nén trên đường truyền (không tự gzip để tránh double-encode).
await writeFile(out(manifest.base), JSON.stringify(base))
await writeFile(out(manifest.power), JSON.stringify(power))
await writeFile(out('manifest.json'), JSON.stringify(manifest))

console.log('\n=== KẾT QUẢ ===')
console.log('manifest:', JSON.stringify(manifest))
const sample = power.rows.findIndex((r) => r)
console.log('mẫu base :', JSON.stringify(base.rows[sample]))
console.log('mẫu power:', JSON.stringify(power.rows[sample]))
console.log(`\nxong trong ${((Date.now() - t0) / 1000).toFixed(1)}s`)
