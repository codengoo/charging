// Proxy chi tiết trạm `/api/station/<entityId>` -> `get-locator/<entityId>` của VinFast.
// Client gọi thẳng không được (CORS + Cloudflare của VinFast chặn UA lạ), nên đi qua Worker,
// rút gọn còn vài trăm byte và cache ở edge. Chỉ gọi khi người dùng mở MỘT trạm.
import type { PortGroup, StationDetail } from '../src/data/types'

const SITE = 'https://vinfastauto.com/vn_vi'
const PAGE = `${SITE}/tim-kiem-showroom-tram-sac`

/** UA mặc định của runtime ăn trang "Just a moment" (403) — phải giống trình duyệt. */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

/** Ảnh + cổng gần như không đổi trong ngày; giữ 6 giờ ở edge để VinFast không thấy dồn request. */
const TTL_OK = 6 * 3600
/** Lỗi/chặn: cache ngắn để không dội VinFast, nhưng cũng không kẹt lỗi lâu. */
const TTL_FAIL = 60

const STANDARD: Record<string, string> = {
  IEC_62196_T2_COMBO: 'CCS2',
  IEC_62196_T2: 'Type 2',
  IEC_62196_T1_COMBO: 'CCS1',
  CHADEMO: 'CHAdeMO',
  GBT_DC: 'GB/T DC',
  GBT_AC: 'GB/T AC',
}

export async function serveStationDetail(url: URL, ctx: ExecutionContext): Promise<Response> {
  const id = url.pathname.slice('/api/station/'.length)
  // entityId là số; chặn mọi thứ khác để Worker không thành proxy mở tới VinFast.
  if (!/^\d{1,9}$/.test(id)) return json({ error: 'bad id' }, 400, 0)

  const cache = caches.default
  const key = new Request(new URL(`/api/station/${id}`, url.origin).toString())
  const hit = await cache.match(key)
  if (hit) return hit

  let res: Response
  try {
    const raw = await fetchLocator(id)
    const detail = raw && parseDetail(raw)
    res = detail ? json(detail, 200, TTL_OK) : json({ error: 'not found' }, 404, TTL_FAIL)
  } catch {
    res = json({ error: 'upstream' }, 502, TTL_FAIL)
  }
  ctx.waitUntil(cache.put(key, res.clone()))
  return res
}

/**
 * Gọi get-locator. Hiện không cần cookie, nhưng Cloudflare của VinFast có lúc đòi `__cf_bm`:
 * 403 thì ghé trang tìm trạm lấy cookie rồi thử lại MỘT lần (mỗi lần mở trạm tối đa 3 subrequest).
 */
async function fetchLocator(id: string): Promise<Record<string, unknown> | null> {
  let res = await call(id)
  if (res.status === 403) {
    const warm = await fetch(PAGE, { headers: { 'User-Agent': UA, Accept: 'text/html' } })
    await warm.body?.cancel()
    const cookie = (warm.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(';')[0])
      .join('; ')
    if (cookie) res = await call(id, cookie)
  }
  if (!res.ok) {
    await res.body?.cancel()
    if (res.status === 404) return null
    throw new Error(`get-locator ${res.status}`)
  }
  const text = await res.text()
  // HTML thay vì JSON = trang chặn của Cloudflare, không phải "trạm không tồn tại".
  if (!text.startsWith('{')) throw new Error('blocked')
  return JSON.parse(text) as Record<string, unknown>
}

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

function json(body: unknown, status: number, ttl: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': ttl ? `public, max-age=${ttl}` : 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
