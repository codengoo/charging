import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { seoShardOf } from './src/lib/stationUrl'

/**
 * Sinh dữ liệu preview link trạm lúc build (chỉ `vite build`, không chạy ở dev):
 * `/seo/<n>.json` — trạm chia theo `entityId % 128`, chỉ giữ [name, address, flags].
 *
 * Pages Function `/tram/*` chỉ đọc MỘT shard (~25 KB) thay vì cả `stations.json` 4 MB —
 * parse 4 MB vượt hạn 10 ms CPU của Functions gói miễn phí.
 *
 * KHÔNG sinh sitemap cho trạm: dữ liệu trạm là nội bộ, sitemap tĩnh ở public/sitemap.xml
 * chỉ có trang chủ.
 */
export function seoPlugin(): Plugin {
  return {
    name: 'tramsac-seo',
    apply: 'build',
    generateBundle() {
      const file = path.resolve(import.meta.dirname, 'public/stations.json')
      const bundle = JSON.parse(fs.readFileSync(file, 'utf8')) as { rows: unknown[][] }

      const shards: Record<string, unknown[]>[] = Array.from({ length: 128 }, () => ({}))
      for (const r of bundle.rows) {
        const id = r[0] as string
        shards[seoShardOf(id)][id] = [r[2], r[3], r[6]]
      }
      shards.forEach((s, i) =>
        this.emitFile({ type: 'asset', fileName: `seo/${i}.json`, source: JSON.stringify(s) }),
      )
    },
  }
}
