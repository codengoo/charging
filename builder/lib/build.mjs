// Lõi build: lấy version mới nhất, stream snapshot + KML, trộn enrich, đóng gói.
// Portable (Node 18+ và Cloudflare Workers). Phần I/O (fetch/gzip) do caller cấp qua deps
// để test được; mặc định dùng fetch + CompressionStream chuẩn.

import { streamCarStations } from './snapshot.mjs'
import { indexKml, coordKey } from './kml.mjs'

const CDN = 'https://static-cms-prod.vinfastauto.com/locators'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

// 2 Google My Maps: map 1 = sạc nhanh DC, map 2 = sạc chậm AC.
const MYMAPS = [
  { mid: '1iIZ3L3KEKU0fg5XsIQ6hbRl7NVY8JNA', isDc: 1 },
  { mid: '1y__rpsMtCNT8qCO0ERpXJwXcom5VE2s', isDc: 0 },
]

const kmlUrl = (mid) => `https://www.google.com/maps/d/kml?mid=${mid}&forcekml=1`

async function fetchStream(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok || !res.body) throw new Error(`GET ${url} → ${res.status}`)
  return res.body
}

/**
 * Trả về luồng TEXT từ một luồng byte, tự nhận biết gzip qua magic byte 1f 8b.
 * Cần vì fetch (Node undici / Workers) có thể đã tự giải nén `Content-Encoding: gzip`
 * hoặc chưa — sniff để đúng ở cả hai.
 */
async function toTextStream(byteStream) {
  const reader = byteStream.getReader()
  const first = await reader.read()
  const head = first.value ?? new Uint8Array()
  const isGzip = head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b
  const replay = new ReadableStream({
    start(c) {
      if (head.length) c.enqueue(head)
      if (first.done) c.close()
    },
    async pull(c) {
      const { value, done } = await reader.read()
      if (done) c.close()
      else c.enqueue(value)
    },
    cancel(r) {
      reader.cancel(r)
    },
  })
  const bytes = isGzip ? replay.pipeThrough(new DecompressionStream('gzip')) : replay
  return bytes.pipeThrough(new TextDecoderStream())
}

/** Đọc con trỏ version mới nhất của VinFast. */
export async function fetchMeta() {
  const res = await fetch(`${CDN}/locators-meta.json`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`meta → ${res.status}`)
  return res.json() // { generation, count, full, sc }
}

/** Gói kW thành chuỗi "kw:count:dc|…" (gộp theo kW, sắp giảm dần). */
function packGroups(groups) {
  const byKw = new Map()
  for (const [kw, count, dc] of groups) {
    const k = `${kw}:${dc}`
    byKw.set(k, (byKw.get(k) || 0) + count)
  }
  return [...byKw.entries()]
    .map(([k, count]) => {
      const [kw, dc] = k.split(':')
      return { kw: +kw, count, dc: +dc }
    })
    .sort((a, b) => b.kw - a.kw)
}

/** Tra enrich cho một trạm: khớp ô 4-dec rồi dò 3×3 lân cận. */
function lookupPower(index, lat, lng) {
  let hit = index.get(coordKey(lat, lng))
  if (!hit) {
    const la = +lat.toFixed(4)
    const ln = +lng.toFixed(4)
    for (let dla = -1; dla <= 1 && !hit; dla++)
      for (let dln = -1; dln <= 1 && !hit; dln++) {
        if (dla === 0 && dln === 0) continue
        hit = index.get(coordKey(la + dla * 1e-4, ln + dln * 1e-4))
      }
  }
  return hit
}

/**
 * Chạy full pipeline. Trả về { manifest, base, power } đã sẵn sàng ghi.
 * @param {(msg:string)=>void} log
 */
export async function buildData(log = () => {}) {
  const meta = await fetchMeta()
  const generation = meta.generation
  log(`generation=${generation} full=${meta.full}`)

  // 1) Index enrich từ 2 KML (giữ index nhỏ trong RAM).
  const index = new Map()
  for (const m of MYMAPS) {
    const { count } = await indexKml(await fetchStream(kmlUrl(m.mid)), m.isDc, index)
    log(`KML ${m.isDc ? 'DC' : 'AC'}: ${count} điểm`)
  }
  log(`index toạ độ: ${index.size}`)

  // 2) Stream snapshot → base rows + power rows (căn chỉnh theo index).
  const baseRows = []
  const powerRows = []
  let matched = 0
  const statusCount = [0, 0, 0, 0]
  const snapText = await toTextStream(await fetchStream(`${CDN}/${meta.full}`))
  for await (const r of streamCarStations(snapText)) {
    baseRows.push([r.entityId, r.storeId, r.name, r.address, r.lat, r.lng, r.flags, r.availableDate ?? 0, r.status])
    statusCount[r.status]++
    const hit = lookupPower(index, r.lat, r.lng)
    if (!hit) {
      powerRows.push(null) // lệch → bỏ qua, để trống
      continue
    }
    const groups = packGroups(hit.groups)
    const portCount = groups.reduce((s, g) => s + g.count, 0)
    const maxKw = groups.reduce((m, g) => Math.max(m, g.kw), 0)
    const dcCount = groups.filter((g) => g.dc).reduce((s, g) => s + g.count, 0)
    const g = groups.map((x) => `${x.kw}:${x.count}:${x.dc}`).join('|')
    powerRows.push([portCount, maxKw, dcCount, g])
    matched++
  }
  log(`base: ${baseRows.length} trạm ô tô | enrich khớp: ${matched} (${((matched / baseRows.length) * 100).toFixed(1)}%)`)
  log(
    `trạng thái: hoạt động ${statusCount[0]} | bảo trì ${statusCount[1]} | ngừng ${statusCount[2]} | ` +
      `chưa khai trương ${statusCount[3]}`,
  )

  const builtAt = new Date().toISOString()
  const base = {
    v: 3,
    generation,
    builtAt,
    // v3 = v2 + cột status (0 hoạt động, 1 bảo trì, 2 ngừng, 3 chưa khai trương). Client cũ bỏ
    // qua cột thừa nên không vỡ.
    fields: ['id', 'storeId', 'name', 'address', 'lat', 'lng', 'flags', 'availableDate', 'status'],
    rows: baseRows,
  }
  const power = {
    v: 2,
    generation,
    builtAt,
    // null = chưa có dữ liệu; ngược lại [portCount, maxKw, dcCount, "kw:count:dc|…"]
    fields: ['portCount', 'maxKw', 'dcCount', 'groups'],
    rows: powerRows,
  }
  const manifest = {
    generation,
    builtAt,
    base: `base-${generation}.json`,
    power: `power-${generation}.json`,
    counts: { stations: baseRows.length, enriched: matched },
  }
  return { manifest, base, power }
}
