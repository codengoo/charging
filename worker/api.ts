// /api/route, /api/drive, /api/geocode, /api/revgeocode, /api/maps-link: proxy HERE (giấu key) + mở link
// rút gọn Google Maps. Worker CHỈ làm I/O: body HERE trả nguyên (stream), không parse — Workers
// Free plan giới hạn 10 ms CPU. Client lo giải mã polyline, đọc link, lọc hành lang.
// (/api/station/* là proxy chi tiết VinFast, ở worker/locator.ts, không đi qua đây.)

import { serveLive } from './evcs'

export interface ApiEnv {
  /** Secret: `npx wrangler secret put HERE_API_KEY`; local: `.dev.vars`. */
  HERE_API_KEY?: string
  API_LIMIT: RateLimit
}

const SITE_HOSTS = new Set(['charging.cangao.asia', 'localhost', '127.0.0.1'])
const SHORTENERS = new Set(['maps.app.goo.gl', 'goo.gl', 'g.co'])
/** HERE Routing v8 cho tối đa 200 via, nhưng Google Maps chỉ cho 9 — 20 là trần rộng rãi (giống app Android). */
const MAX_VIA = 20
/** Google trả trang chuyển hướng gọn hơn cho UA điện thoại (giống app Android). */
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36'
const MAX_HOPS = 5
/** Chỉ quét chừng này byte HTML tìm URL /maps/ — regex trên cả trang dễ vượt 10 ms CPU. */
const MAX_BODY = 256 * 1024

const COORD = /^-?\d{1,3}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?$/

export async function serveApi(req: Request, url: URL, env: ApiEnv): Promise<Response> {
  if (req.method !== 'GET') return fail(405, 'Chỉ nhận GET')
  if (!sameSite(req)) return fail(403, 'Không cho phép')
  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown'
  const { success } = await env.API_LIMIT.limit({ key: ip })
  if (!success) return fail(429, 'Gọi quá nhanh, thử lại sau ít phút')

  try {
    if (url.pathname.startsWith('/api/live')) return await serveLive(url)
    switch (url.pathname) {
      case '/api/route':
        return await route(url, env)
      case '/api/drive':
        return await drive(url, env)
      case '/api/geocode':
        return await geocode(url, env)
      case '/api/revgeocode':
        return await revgeocode(url, env)
      case '/api/maps-link':
        return await mapsLink(url)
      default:
        return fail(404, 'Not found')
    }
  } catch {
    // Không log gì: URL gọi HERE có apiKey.
    return fail(502, 'Lỗi mạng khi gọi dịch vụ bản đồ')
  }
}

/**
 * Cùng origin. Trình duyệt KHÔNG gửi `Origin` cho fetch GET cùng origin, nên xét
 * `Sec-Fetch-Site` trước, rồi mới tới Origin/Referer (trình duyệt cũ).
 * Script tự làm giả được — rate limit mới là hàng rào thật.
 */
export function sameSite(req: Request): boolean {
  const site = req.headers.get('Sec-Fetch-Site')
  if (site) return site === 'same-origin'
  const from = req.headers.get('Origin') ?? req.headers.get('Referer')
  if (!from) return false
  try {
    return SITE_HOSTS.has(new URL(from).hostname)
  } catch {
    return false
  }
}

// ------------------------------------------------------------ HERE

function hereKey(env: ApiEnv): string | null {
  return env.HERE_API_KEY?.trim() || null
}

/** Gọi HERE, trả nguyên body. Lỗi phía HERE → 502 nhưng vẫn giữ body để client đọc nếu cần. */
async function passHere(target: URL, ttl: number): Promise<Response> {
  const res = await fetch(target.toString(), { headers: { Accept: 'application/json' } })
  return new Response(res.body, {
    status: res.ok ? 200 : 502,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // private: tuyến/điểm của từng người, không cho CDN dùng chung.
      'Cache-Control': res.ok ? `private, max-age=${ttl}` : 'no-store',
    },
  })
}

/** Tên tuỳ chọn tránh của app → `avoid[features]` của HERE. Chỉ nhận đúng các tên này. */
const AVOID_FEATURE: Record<string, string> = { toll: 'tollRoad', highway: 'controlledAccessHighway', ferry: 'ferry' }

/**
 * `stops=lat,lng;lat,lng!p;…` (2..22 điểm; giữa là via, đuôi `!p` = chỉ đi qua chứ không dừng —
 * điểm kéo tuyến trên Google), `alt=0..2` (số tuyến khác muốn xin), `avoid=toll,highway,ferry`.
 */
async function route(url: URL, env: ApiEnv): Promise<Response> {
  const stops = (url.searchParams.get('stops') ?? '')
    .split(';')
    .filter(Boolean)
    .map((s) => ({ at: s.replace(/!p$/, ''), pass: s.endsWith('!p') }))
  if (stops.length < 2 || !stops.every((s) => COORD.test(s.at))) return fail(400, 'stops không hợp lệ')
  const origin = stops[0]
  const destination = stops[stops.length - 1]
  if (origin.pass || destination.pass) return fail(400, 'stops không hợp lệ')
  const key = hereKey(env)
  if (!key) return fail(503, 'Chưa cấu hình HERE_API_KEY')
  const via = stops.slice(1, -1).slice(0, MAX_VIA)
  // Có điểm giữa = người dùng đã chốt hướng, không xin tuyến khác.
  const alt = via.length === 0 ? Math.min(Math.max(parseInt(url.searchParams.get('alt') ?? '', 10) || 0, 0), 2) : 0
  const avoid = [...new Set((url.searchParams.get('avoid') ?? '').split(',').map((s) => AVOID_FEATURE[s]).filter(Boolean))]

  const target = new URL('https://router.hereapi.com/v8/routes')
  target.searchParams.set('transportMode', 'car')
  target.searchParams.set('origin', origin.at)
  for (const v of via) target.searchParams.append('via', v.pass ? `${v.at}!passThrough=true` : v.at)
  target.searchParams.set('destination', destination.at)
  if (alt > 0) target.searchParams.set('alternatives', String(alt))
  if (avoid.length) target.searchParams.set('avoid[features]', avoid.join(','))
  target.searchParams.set('return', 'polyline,summary')
  target.searchParams.set('spans', 'length,functionalClass')
  target.searchParams.set('apiKey', key)
  return passHere(target, 300)
}

/**
 * `from=lat,lng&to=lat,lng` → quãng đường lái xe thật (chỉ `summary`, vài trăm byte). Dùng khi
 * mở một trạm — giống HereRouting.route() bên Android. 1 lượt Routing Car mỗi cặp điểm.
 */
async function drive(url: URL, env: ApiEnv): Promise<Response> {
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  if (!COORD.test(from) || !COORD.test(to)) return fail(400, 'from/to không hợp lệ')
  const key = hereKey(env)
  if (!key) return fail(503, 'Chưa cấu hình HERE_API_KEY')
  const target = new URL('https://router.hereapi.com/v8/routes')
  target.searchParams.set('transportMode', 'car')
  target.searchParams.set('origin', from)
  target.searchParams.set('destination', to)
  target.searchParams.set('return', 'summary')
  target.searchParams.set('apiKey', key)
  return passHere(target, 600)
}

/** `q` (≤ 200 ký tự), `at` tuỳ chọn để ưu tiên kết quả gần đó. */
async function geocode(url: URL, env: ApiEnv): Promise<Response> {
  const q = (url.searchParams.get('q') ?? '').trim()
  if (!q || q.length > 200) return fail(400, 'q không hợp lệ')
  const key = hereKey(env)
  if (!key) return fail(503, 'Chưa cấu hình HERE_API_KEY')
  const at = url.searchParams.get('at')

  // Có vị trí tham chiếu → discover (tìm theo tên quanh đó); không có → geocode giới hạn VN.
  const target = at && COORD.test(at)
    ? new URL('https://discover.search.hereapi.com/v1/discover')
    : new URL('https://geocode.search.hereapi.com/v1/geocode')
  if (at && COORD.test(at)) target.searchParams.set('at', at)
  else target.searchParams.set('in', 'countryCode:VNM')
  target.searchParams.set('q', q)
  target.searchParams.set('lang', 'vi-VN')
  target.searchParams.set('limit', '1')
  target.searchParams.set('apiKey', key)
  return passHere(target, 3600)
}

async function revgeocode(url: URL, env: ApiEnv): Promise<Response> {
  const at = url.searchParams.get('at') ?? ''
  if (!COORD.test(at)) return fail(400, 'at không hợp lệ')
  const key = hereKey(env)
  if (!key) return fail(503, 'Chưa cấu hình HERE_API_KEY')
  const target = new URL('https://revgeocode.search.hereapi.com/v1/revgeocode')
  target.searchParams.set('at', at)
  target.searchParams.set('lang', 'vi')
  target.searchParams.set('limit', '1')
  target.searchParams.set('apiKey', key)
  return passHere(target, 3600)
}

// ------------------------------------------------------------ link rút gọn

/** URL đích phải là google.<tld>/maps… — chặn biến endpoint thành máy mở link tuỳ ý. */
function isMapsUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'https:' && /^(www\.)?google\.[a-z.]{2,10}$/.test(u.hostname) && u.pathname.startsWith('/maps')
  } catch {
    return false
  }
}

/**
 * Mở link `maps.app.goo.gl/…` phía server (client gọi thẳng bị CORS). Theo redirect TỪNG BƯỚC
 * để chỉ đi qua host cho phép; không có Location hợp lệ thì tìm URL /maps/ trong body.
 */
async function mapsLink(url: URL): Promise<Response> {
  let current: URL
  try {
    current = new URL(url.searchParams.get('url') ?? '')
  } catch {
    return fail(400, 'url không hợp lệ')
  }
  if (current.protocol !== 'https:' || !SHORTENERS.has(current.hostname)) return fail(400, 'Chỉ nhận link rút gọn Google Maps')

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const res = await fetch(current.toString(), {
      redirect: 'manual',
      headers: { 'User-Agent': MOBILE_UA, 'Accept-Language': 'vi-VN,vi;q=0.9' },
    })
    const loc = res.headers.get('Location')
    if (loc) {
      await res.body?.cancel()
      const next = new URL(loc, current)
      if (isMapsUrl(next.toString())) return ok({ url: next.toString() })
      // Chỉ tiếp tục qua các host rút gọn của Google; host khác (consent, đăng nhập…) thì thôi.
      if (!SHORTENERS.has(next.hostname) && !/^(www\.)?google\.[a-z.]+$/.test(next.hostname)) break
      current = next
      continue
    }
    const found = await findMapsUrl(res)
    if (found) return ok({ url: found })
    break
  }
  return fail(502, 'Không mở được liên kết rút gọn')
}

async function findMapsUrl(res: Response): Promise<string | null> {
  if (!res.body) return null
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  while (text.length < MAX_BODY) {
    const { value, done } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
  }
  await reader.cancel()
  const m = /https:\/\/www\.google\.[a-z.]+\/maps\/[^"'\\\s<>]+/.exec(text)
  if (!m) return null
  const found = m[0].replace(/&amp;/g, '&')
  return isMapsUrl(found) ? found : null
}

// ------------------------------------------------------------ tiện ích

function ok(body: unknown): Response {
  return Response.json(body, { headers: { 'Cache-Control': 'private, max-age=3600' } })
}

function fail(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}
