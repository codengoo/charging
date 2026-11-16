// Chạy pipeline ETL, ghi JSON thô ra builder/out/. Dùng cho GitHub Action (rồi upload R2)
// và để kiểm tra local. Chỉ cần Node (không npm dep).
//   node builder/run-local.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { buildData } from './lib/build.mjs'

const t0 = Date.now()
const { manifest, base, power } = await buildData((m) => console.log('·', m))

await mkdir(new URL('./out/', import.meta.url), { recursive: true })
const out = (name) => new URL(`./out/${name}`, import.meta.url)

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
