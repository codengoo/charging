// Số cổng ĐANG TRỐNG theo thời gian thực từ EVCS.VN — port EvcsApi / EvcsHistory của app
// Android. `charging_status` của VinFast trễ 1–2 giờ và chỉ là một bit cho cả trạm; EVCS trả
// số cổng trống theo từng mức kW, gần như tức thời. `storeId` của VinFast ("C.HNO1129") chính
// là locationId của EVCS — không cần bảng ánh xạ.
//
//   GET /api/live/<storeId>          → JSON /charging nguyên văn (cache 60 s, dùng chung)
//   GET /api/live-history/<storeId>  → {"all":[[t,xe]…],"kw":{hours,series}|null} 24h (cache 5')
//   GET /api/live-nearby?at=lat,lng  → JSON /search nguyên văn: ~50 trạm quanh đó (cache 5')
//
// Worker CHỈ làm I/O, không parse JSON lớn (Free plan 10 ms CPU): lịch sử ghép bằng cắt chuỗi.
// Cache bằng Cache API theo trạm — nhiều người mở cùng một trạm chỉ tốn một lượt gọi EVCS,
// và EVCS vốn đã cache phía họ ~5 phút, gọi dày hơn không tươi hơn mà dễ bị chặn nhịp.

const SITE = 'https://evcs.vn'
/**
 * /charging và /search gọi qua host phụ: Cloudflare của EVCS chặn hai đường này trên evcs.vn khi
 * request đi từ Worker (403), còn www1 thì qua (www2 cũng bị chặn). Referer vẫn là
 * trang evcs.vn — /charging đòi Referer thuộc evcs.vn.
 */
const API = 'https://www1.evcs.vn'
const WS_URL = 'https://www2.evcs.vn/socket.io/?EIO=4&transport=websocket'
const UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
const STORE_ID = /^C\.[A-Z0-9]{2,8}$/i
const COORD = /^-?\d{1,3}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?$/

/** apiToken sống 299 s, chargeToken 599 s — làm mới cả đôi trước cái yếu hơn, chừa 60 s. */
const TOKEN_TTL_MS = 180_000
/** Lỗi tạm (503, HTML chặn) thử lại 2 lần: 700 ms rồi 1,8 s — nhanh hơn lại ăn 503 tiếp. */
const BACKOFF_MS = [700, 1800]
/** Cả chuỗi lịch sử thường về trong 0,7–1,5 s; quá 8 s là hỏng chứ không phải chậm. */
const HISTORY_TIMEOUT_MS = 8000
/** Chờ thêm chuỗi tách theo kW sau khi đã có chuỗi gộp — có trạm server không gửi. */
const KW_GRACE_MS = 2000

const TTL_LIVE = 60
/** Ngắn hơn 5' vì lịch sử còn là nguồn dự phòng cho số cổng trống khi /charging bị chặn. */
const TTL_HISTORY = 120
const TTL_NEARBY = 300

/** Token ở cấp phiên, không gắn theo trạm. Sống theo isolate — đủ để đỡ phần lớn lượt xin. */
let tokens: { charge: string; api: string; at: number } | null = null

const pageOf = (storeId: string) => `${SITE}/tram-sac-vinfast-x-${storeId.toLowerCase()}.html`
const browser = (referer: string): Record<string, string> => ({
  'User-Agent': UA,
  'Accept-Language': 'vi,en;q=0.9',
  Referer: referer,
})
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class Transient extends Error {}

function json(body: BodyInit, status: number, ttl: number): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 ? `public, max-age=${ttl}` : 'no-store',
    },
  })
}
const failJson = (status: number, error: string) => json(JSON.stringify({ error }), status, 0)

/**
 * POST vào một trang trạm với `X-Partial: user` → chargeToken + apiToken. Phần chữ trong
 * đường dẫn không quan trọng, server chỉ đọc hậu tố storeId. Không cần cookie.
 */
async function getTokens(storeId: string): Promise<{ charge: string; api: string }> {
  if (tokens && Date.now() - tokens.at < TOKEN_TTL_MS) return tokens
  const page = pageOf(storeId)
  const res = await fetch(page, { method: 'POST', headers: { ...browser(page), 'X-Partial': 'user' } })
  const text = await res.text()
  if (!text.startsWith('{')) throw new Transient('token: không phải JSON')
  const j = JSON.parse(text) as { chargeToken?: string; apiToken?: string }
  if (!j.chargeToken) throw new Transient('token: thiếu chargeToken')
  tokens = { charge: j.chargeToken, api: j.apiToken ?? '', at: Date.now() }
  return tokens
}

async function liveOnce(storeId: string): Promise<string> {
  const t = await getTokens(storeId)
  const res = await fetch(`${API}/charging`, {
    method: 'POST',
    headers: { ...browser(pageOf(storeId)), 'x-t': t.charge, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: storeId, t: 'vinfast' }),
  })
  if (res.status === 503) throw new Transient('http 503')
  const text = await res.text()
  // HTML thay vì JSON = Cloudflare chặn hoặc phiên chết: vứt token để lần thử sau xin mới.
  // 403 là chặn IP Worker — thử lại vẫn 403, chỉ làm người dùng chờ thêm ~3 s.
  if (!text.startsWith('{')) {
    tokens = null
    if (res.status === 403) throw new Error('charging http 403')
    throw new Transient(`charging http ${res.status}`)
  }
  // {"ok":false,…} đi kèm mã 200 — bận, không phải "trạm không có số liệu".
  if (/^\{\s*"ok"\s*:\s*false/.test(text)) throw new Transient('ok:false')
  return text
}

async function live(storeId: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return json(await liveOnce(storeId), 200, TTL_LIVE)
    } catch (e) {
      if (!(e instanceof Transient) || attempt >= BACKOFF_MS.length) {
        return failJson(e instanceof Transient ? 503 : 502, `EVCS đang bận (${e instanceof Error ? e.message : 'lỗi'})`)
      }
      await sleep(BACKOFF_MS[attempt])
    }
  }
}

/**
 * Lịch sử 24h số xe đang sạc qua socket.io v4 trên WebSocket thường:
 *   "0{…}" OPEN → gửi "40{t:apiToken}" CONNECT; "2" ping → trả "3";
 *   "40…" đã nối → subscribe + history; "42[tên, dữ liệu]" sự kiện; "44…" token hỏng.
 * Payload ghép bằng cắt chuỗi (không JSON.parse) để khỏi tốn CPU.
 */
async function historyOnce(storeId: string): Promise<{ status: number; body: string }> {
  const t = await getTokens(storeId)
  const res = await fetch(WS_URL, { headers: { Upgrade: 'websocket', Origin: SITE, 'User-Agent': UA } })
  const ws = res.webSocket
  if (!ws) throw new Transient(`ws: http ${res.status}`)
  ws.accept()

  return new Promise((resolve) => {
    let all: string | null = null
    let kw: string | null = null
    let done = false
    const finish = (status: number, body: string) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try {
        ws.close(1000)
      } catch {
        // đã đóng
      }
      resolve({ status, body })
    }
    const ok = () => finish(200, `{"all":${all},"kw":${kw ?? 'null'}}`)
    const timer = setTimeout(() => (all ? ok() : finish(504, '{"error":"Quá hạn chờ"}')), HISTORY_TIMEOUT_MS)
    /** `42["tên",<payload>]` → `<payload>` (bỏ tên và dấu ] cuối). */
    const payload = (s: string) => s.slice(s.indexOf(',') + 1, s.lastIndexOf(']'))

    ws.addEventListener('message', (ev) => {
      const s = typeof ev.data === 'string' ? ev.data : ''
      if (s === '2') return ws.send('3')
      if (s.startsWith('40')) {
        ws.send('42' + JSON.stringify(['subscribe', storeId]))
        ws.send('42' + JSON.stringify(['history', { stationId: storeId, hours: 24, token: '', detail: true }]))
        return
      }
      if (s.startsWith('0')) return ws.send('40' + JSON.stringify({ t: t.api }))
      // Token hết hạn: server trả 44 rồi IM LẶNG — bắt ở đây để hỏng là biết ngay.
      if (s.startsWith('44')) {
        tokens = null
        return finish(401, '{"error":"Phiên hết hạn"}')
      }
      if (!s.startsWith('42')) return
      if (s.startsWith('42["history_data"')) {
        all = payload(s)
        if (kw) ok()
        else setTimeout(ok, KW_GRACE_MS)
      } else if (s.startsWith('42["history_kw_data"')) {
        kw = payload(s)
        if (all) ok()
      } else if (s.startsWith('42["history_error"')) {
        finish(404, '{"error":"Trạm không có số liệu"}')
      }
    })
    ws.addEventListener('close', () => (all ? ok() : finish(502, '{"error":"Mất kết nối"}')))
    ws.addEventListener('error', () => (all ? ok() : finish(502, '{"error":"Mất kết nối"}')))
  })
}

async function history(storeId: string): Promise<Response> {
  try {
    let r = await historyOnce(storeId)
    // Đồng hồ hai bên lệch nên token còn hạn theo ta mà server đã từ chối: xin mới, thử MỘT lần.
    if (r.status === 401) r = await historyOnce(storeId)
    return json(r.body, r.status, TTL_HISTORY)
  } catch {
    return failJson(502, 'Không nối được EVCS')
  }
}

/**
 * ~50 trạm gần một toạ độ kèm số cổng trống theo kW — chính bản đồ của EVCS dùng endpoint
 * này. Không cần token, chỉ cần UA trình duyệt. Toạ độ đã làm tròn ở client (~1 km).
 */
async function nearby(at: string): Promise<Response> {
  const [lat, lng] = at.split(',').map(Number)
  const res = await fetch(`${API}/search`, {
    method: 'POST',
    headers: { ...browser(`${SITE}/`), 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: lat, longitude: lng }),
  })
  const text = await res.text()
  if (!res.ok || !text.startsWith('{')) {
    return failJson(503, `EVCS đang bận (search http ${res.status})`)
  }
  return json(text, 200, TTL_NEARBY)
}

/** Bọc Cache API: trúng cache thì không đụng EVCS; chỉ lưu kết quả 200. */
async function cached(key: string, run: () => Promise<Response>): Promise<Response> {
  const cache = caches.default
  const req = new Request(`https://evcs-cache.internal/${key}`)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await run()
  if (res.status === 200) await cache.put(req, res.clone())
  return res
}

export async function serveLive(url: URL): Promise<Response> {
  const p = url.pathname
  if (p.startsWith('/api/live/')) {
    const id = decodeURIComponent(p.slice('/api/live/'.length)).toUpperCase()
    if (!STORE_ID.test(id)) return failJson(400, 'storeId không hợp lệ')
    return cached(`live/${id}`, () => live(id))
  }
  if (p.startsWith('/api/live-history/')) {
    const id = decodeURIComponent(p.slice('/api/live-history/'.length)).toUpperCase()
    if (!STORE_ID.test(id)) return failJson(400, 'storeId không hợp lệ')
    return cached(`history/${id}`, () => history(id))
  }
  if (p === '/api/live-nearby') {
    const at = url.searchParams.get('at') ?? ''
    if (!COORD.test(at)) return failJson(400, 'at không hợp lệ')
    return cached(`nearby/${at}`, () => nearby(at))
  }
  return failJson(404, 'Not found')
}
