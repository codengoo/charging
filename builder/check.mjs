// @ts-check
// Chặn upload bản build hỏng: số trạm quá ít, hoặc tụt mạnh so với manifest đang chạy.
//   node builder/check.mjs [url-manifest-đang-chạy]
// Thoát mã 1 = KHÔNG upload. Không lấy được manifest đang chạy thì chỉ kiểm ngưỡng tuyệt đối.
import { readFile } from 'node:fs/promises'

/** VinFast có ~25.000 trạm ô tô (11/2026); dưới mức này chắc chắn là snapshot cụt. */
const MIN_STATIONS = 20_000
/** Tụt hơn 5% trong một ngày là bất thường (trạm đóng cửa không nhiều vậy). */
const MAX_DROP = 0.05
/** Tỉ lệ trạm có số cổng tối thiểu — My Maps lỗi thì enrich về gần 0. */
const MIN_ENRICHED = 0.5

const LIVE = process.argv[2] ?? 'https://charging.cangao.asia/data/manifest.json'

/** @type {import('../src/data/format').DataManifest} */
const next = JSON.parse(await readFile(new URL('./out/manifest.json', import.meta.url), 'utf8'))
const { stations, enriched } = next.counts
/** @returns {Promise<string | null>} lý do chặn, null = cho qua */
async function verdict() {
  if (stations < MIN_STATIONS) return `chỉ có ${stations} trạm (< ${MIN_STATIONS})`
  if (enriched / stations < MIN_ENRICHED) return `chỉ ${enriched}/${stations} trạm có số cổng (< ${MIN_ENRICHED * 100}%)`
  let note
  try {
    const res = await fetch(LIVE, { cache: 'no-store' })
    if (res.ok) {
      /** @type {import('../src/data/format').DataManifest} */
      const live = await res.json()
      const prev = live.counts?.stations ?? 0
      if (prev && stations < prev * (1 - MAX_DROP)) return `số trạm tụt từ ${prev} xuống ${stations} (> ${MAX_DROP * 100}%)`
      note = `đang chạy: ${prev}`
    } else note = `không đọc được manifest đang chạy: ${res.status}`
  } catch (e) {
    note = `không đọc được manifest đang chạy: ${e instanceof Error ? e.message : e}`
  }
  console.log(`✓ ${stations} trạm, ${enriched} có số cổng (${note})`)
  return null
}

const reason = await verdict()
if (reason) {
  console.error('✗', reason)
  // exitCode thay vì process.exit(): thoát ngang lúc fetch còn mở handle làm Node trên Windows văng assert.
  process.exitCode = 1
}
