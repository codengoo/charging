// Proxy chi tiết trạm `/api/station/<entityId>` -> `get-locator/<entityId>` của VinFast.
// Client gọi thẳng không được (CORS + Cloudflare của VinFast chặn UA lạ), nên đi qua Worker,
// rút gọn còn vài trăm byte và cache ở edge. Chỉ gọi khi người dùng mở MỘT trạm.
import type { PortGroup, StationDetail } from '../src/data/types'
import { STATION_ID_RE } from '../src/lib/stationUrl'
import { json as toJson, jsonText, NO_STORE } from './http'

const SITE = 'https://vinfastauto.com/vn_vi'
const PAGE = `${SITE}/tim-kiem-showroom-tram-sac`

/** UA mặc định của runtime ăn trang "Just a moment" (403) — phải giống trình duyệt. */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

/** Ảnh + cổng gần như không đổi trong ngày; giữ 6 giờ ở edge để VinFast không thấy dồn request. */
const TTL_OK = 6 * 3600
/** Lỗi/chặn: cache ngắn ở edge để không dội VinFast, nhưng cũng không kẹt lỗi lâu. */
const TTL_FAIL = 60

/**
 * Bản tốt gần nhất của mỗi trạm, trong R2. VinFast chặn Worker LÁC ĐÁC (đo 16/11: ~1/15 lần
 * gọi từ edge ăn 403/trang chặn, cùng lúc gọi từ máy thường vẫn 200) — gặp lúc đó thì trả
 * bản cũ (ảnh + cổng hầu như không đổi) thay vì để người dùng thấy trạm "không có ảnh".
 */
const stashKey = (id: string) => `detail/${id}.json`

const STANDARD: Record<string, string> = {
  IEC_62196_T2_COMBO: 'CCS2',
  IEC_62196_T2: 'Type 2',
  IEC_62196_T1_COMBO: 'CCS1',
  CHADEMO: 'CHAdeMO',
  GBT_DC: 'GB/T DC',
  GBT_AC: 'GB/T AC',
}

/**
 * Một dòng log cho mỗi request (Workers Logs, `observability` trong wrangler.jsonc) để đo VinFast
 * chặn ra sao trên lưu lượng thật. 16/11 đo tay không thấy dấu rate-limit: gọi dồn 8 luồng vẫn
 * qua; chỗ bị chặn thì chặn ngay từ request đầu (4–17 ms, trang `IM_UNDER_ATTACK_BOX`) — nhưng
 * 80 mẫu chưa đủ để biết tỉ lệ thật và lần thử lại cứu được bao nhiêu.
 *
 * Truy vấn trên dashboard: message chứa `"evt":"detail"`, lọc theo `outcome`, `colo`, `calls`.
 */
interface Trace {
  evt: 'detail'
  id: string
  colo?: string
  /** hit: edge cache · ok · not_found · stale: VinFast lỗi, trả bản R2 · fail: lỗi, không có bản cũ. */
  outcome?: 'hit' | 'ok' | 'not_found' | 'stale' | 'fail'
  ms?: number
  reason?: string
  /** Từng lần gọi VinFast: lượt thử (1 | 2), bước, status, có phải trang chặn HTML không. */
  calls: TraceCall[]
}

interface TraceCall {
  try: number
  /** main: get-locator · warm: trang tìm trạm lấy cookie · cookie: get-locator kèm cookie. */
  step: 'main' | 'warm' | 'cookie'
  status: number
  html?: boolean
  ms: number
}

export async function serveStationDetail(
  url: URL,
  data: R2Bucket,
  ctx: ExecutionContext,
  colo?: string,
): Promise<Response> {
  const id = url.pathname.slice('/api/station/'.length)
  // entityId là số; chặn mọi thứ khác để Worker không thành proxy mở tới VinFast.
  if (!STATION_ID_RE.test(id)) return json({ error: 'bad id' }, 400, 0)

  const t0 = Date.now()
  const trace: Trace = { evt: 'detail', id, colo, calls: [] }
  const done = (outcome: NonNullable<Trace['outcome']>) => {
    trace.outcome = outcome
    trace.ms = Date.now() - t0
    console.log(JSON.stringify(trace))
  }

  const cache = caches.default
  const key = new Request(new URL(`/api/station/${id}`, url.origin).toString())
  const hit = await cache.match(key)
  if (hit) {
    done('hit')
    return forBrowser(hit)
  }

  let res: Response
  try {
    const raw = await fetchLocatorRetry(id, trace)
    const detail = raw && parseDetail(raw)
    if (detail) {
      res = json(detail, 200, TTL_OK)
      const body = JSON.stringify(detail)
      ctx.waitUntil(data.put(stashKey(id), body, { httpMetadata: { contentType: 'application/json' } }))
      done('ok')
    } else {
      res = json({ error: 'not found' }, 404, TTL_FAIL)
      done('not_found')
    }
  } catch (e) {
    trace.reason = e instanceof Error ? e.message : String(e)
    const stale = await data.get(stashKey(id))
    if (stale) {
      // Bản cũ: cache edge ngắn để lần sau thử lấy bản mới; báo qua header để còn soi.
      res = jsonText(stale.body, 200, cacheFor(TTL_FAIL), ROBOTS)
      res.headers.set('X-Detail-Stale', stale.uploaded.toISOString())
      done('stale')
    } else {
      res = json({ error: 'upstream', reason: trace.reason }, 502, TTL_FAIL)
      done('fail')
    }
  }
  ctx.waitUntil(cache.put(key, res.clone()))
  return forBrowser(res)
}

/**
 * Trình duyệt KHÔNG được giữ lỗi: zone đặt Browser Cache TTL 4h, đè max-age=60 của ta thành
 * 14400 — một lần bị chặn sẽ kẹt "không ảnh" cả buổi. no-store thì Cloudflare để nguyên.
 * Áp cho cả bản trúng cache edge (lỗi/bản cũ vẫn nằm đó tới 60 s).
 */
function forBrowser(res: Response): Response {
  if (res.status === 200 && !res.headers.has('X-Detail-Stale')) return res
  const out = new Response(res.body, res)
  out.headers.set('Cache-Control', 'no-store')
  return out
}

/**
 * Chặn lác đác nên thử lại hầu như là qua: một lần nữa sau ~400 ms (chậm hơn chút khi gặp
 * chặn còn hơn hiện trạm thiếu ảnh). 404 = trạm không có, không thử lại.
 */
async function fetchLocatorRetry(id: string, trace: Trace): Promise<Record<string, unknown> | null> {
  try {
    return await fetchLocator(id, trace, 1)
  } catch {
    await new Promise((r) => setTimeout(r, 400))
    return fetchLocator(id, trace, 2)
  }
}

/**
 * Gọi get-locator. Hiện không cần cookie, nhưng Cloudflare của VinFast có lúc đòi `__cf_bm`:
 * 403 thì ghé trang tìm trạm lấy cookie rồi thử lại MỘT lần (một lượt tối đa 3 subrequest; kèm thử lại ở
 * [fetchLocatorRetry] là 6 — xa giới hạn 50 của Free plan).
 */
async function fetchLocator(id: string, trace: Trace, attempt: number): Promise<Record<string, unknown> | null> {
  const timed = async (step: TraceCall['step'], run: () => Promise<Response>) => {
    const t = Date.now()
    const r = await run()
    const entry: TraceCall = { try: attempt, step, status: r.status, ms: Date.now() - t }
    trace.calls.push(entry)
    return { r, entry }
  }

  let { r: res, entry } = await timed('main', () => call(id))
  if (res.status === 403) {
    entry.html = isHtml(await res.text())
    const { r: warm } = await timed('warm', () => fetch(PAGE, { headers: { 'User-Agent': UA, Accept: 'text/html' } }))
    await warm.body?.cancel()
    const cookie = (warm.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(';')[0])
      .join('; ')
    if (cookie) ({ r: res, entry } = await timed('cookie', () => call(id, cookie)))
  }
  if (!res.ok) {
    if (!res.bodyUsed) entry.html = isHtml(await res.text())
    if (res.status === 404) return null
    throw new Error(`get-locator ${res.status}`)
  }
  const text = await res.text()
  // HTML thay vì JSON = trang chặn của Cloudflare, không phải "trạm không tồn tại".
  if (!text.startsWith('{')) {
    entry.html = true
    throw new Error('blocked')
  }
  return JSON.parse(text) as Record<string, unknown>
}

/** Trang chặn của Cloudflare (`IM_UNDER_ATTACK_BOX`, "Just a moment") là HTML, không phải JSON. */
const isHtml = (body: string) => body.trimStart().startsWith('<')

function call(id: string, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
    'X-Requested-With': 'XMLHttpRequest',
    Referer: PAGE,
  }
  if (cookie) headers.Cookie = cookie
  return fetch(`${SITE}/get-locator/${id}`, { headers })
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : undefined)
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x): x is Obj => !!obj(x)) : [])
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Port từ LocatorApi.parseDetail của app Android, thêm chuẩn đầu sạc, giờ, hotline, trạng thái. */
export function parseDetail(root: Obj): StationDetail | null {
  const top = obj(root.data)
  const inner = obj(top?.data)
  if (!top || !inner) return null

  const evses = arr(inner.evses)
  const connectors = evses.flatMap((e) => arr(e.connectors))

  const groupMap = new Map<string, PortGroup>()
  let maxKw: number | null = null
  let dcCount = 0
  const standards = new Set<string>()
  for (const c of connectors) {
    const dc = c.power_type === 'DC'
    if (dc) dcCount++
    const std = str(c.standard)
    if (std) standards.add(STANDARD[std] ?? std)
    // Trạm xe máy thiếu max_electric_power -> bỏ khỏi nhóm kW (app chỉ hiện trạm ô tô).
    if (typeof c.max_electric_power !== 'number') continue
    const kw = c.max_electric_power / 1000
    maxKw = Math.max(maxKw ?? 0, kw)
    const k = `${kw}-${dc}`
    const g = groupMap.get(k)
    if (g) g.count++
    else groupMap.set(k, { kw, count: 1, dc })
  }
  const groups = [...groupMap.values()].sort((a, b) => b.kw - a.kw)

  const opening = obj(inner.opening_times)
  const caps = new Set(evses.flatMap((e) => (Array.isArray(e.capabilities) ? e.capabilities : [])))

  return {
    images: arr(inner.images)
      .map((i) => str(i.url))
      .filter((u): u is string => !!u && u.startsWith('https://')),
    // Chỉ đếm evse có connector: C.HNO0009 có 6 evse, 3 cái rỗng (trụ cũ đã gỡ) — thực tế 3 trụ.
    portCount: evses.filter((e) => arr(e.connectors).length > 0).length,
    maxKw,
    dcCount,
    groups,
    standards: [...standards],
    reservable: caps.has('RESERVABLE'),
    open247: opening?.twentyfourseven === true,
    hours: hoursOf(opening),
    hotline: str(top.hotline),
    depotStatus: str(obj(inner.extra_data)?.depot_status),
    updatedAt: str(inner.last_updated),
  }
}

/**
 * OCPI `regular_hours: [{weekday, period_begin, period_end}]` -> "06:00–22:00" khi mọi ngày
 * cùng giờ. Lệch giữa các ngày thì null — thà không nói còn hơn nói sai một nửa.
 */
function hoursOf(opening: Obj | undefined): string | null {
  if (!opening || opening.twentyfourseven === true) return null
  const spans = new Set(
    arr(opening.regular_hours).map((h) => `${str(h.period_begin) ?? '?'}–${str(h.period_end) ?? '?'}`),
  )
  return spans.size === 1 ? [...spans][0] : null
}

const ROBOTS = { 'X-Robots-Tag': 'noindex, nofollow' }
const cacheFor = (ttl: number) => (ttl ? `public, max-age=${ttl}` : NO_STORE)
const json = (body: unknown, status: number, ttl: number): Response => toJson(body, status, cacheFor(ttl), ROBOTS)
