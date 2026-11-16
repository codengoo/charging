// Worker tramsac: phục vụ /data/* từ R2 (JSON thô, Cloudflare tự nén), preview link /tram/*,
// chi tiết trạm /api/station/* (proxy get-locator VinFast), còn lại static assets.
// Build dữ liệu KHÔNG ở đây — chạy bằng GitHub Action (.github/workflows/build-data.yml)
// vì Workers Free plan giới hạn 10ms CPU, không đủ cho parse 72MB snapshot.
import { SITE_URL, parseStationId, stationPath } from '../src/lib/stationUrl'
import { serveStationDetail } from './locator'

interface Env {
  DATA: R2Bucket
  ASSETS: Fetcher
}

/** Phần manifest Worker cần — xem builder/run-local.mjs. */
interface Manifest {
  generation: number
  seo?: { dir: string; shards: number }
}

/** [name, address, flags] */
type SeoRow = [string, string, number]

/**
 * Trang trạm KHÔNG cho máy tìm kiếm lập chỉ mục — dữ liệu trạm là nội bộ, link chỉ để chia
 * sẻ. Đặt cả header lẫn thẻ meta: một số bot chỉ đọc một trong hai. Không chặn bằng
 * robots.txt, vì bot bị chặn thì không đọc được noindex và vẫn có thể liệt kê URL trần.
 */
const NOINDEX = 'noindex, nofollow, noarchive'

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/api/station/')) return serveStationDetail(url, env.DATA, ctx)
    if (url.pathname.startsWith('/data/')) return serveData(url, env)
    if (url.pathname.startsWith('/tram/')) return serveStation(url, env)
    return env.ASSETS.fetch(req)
  },
}

async function serveData(url: URL, env: Env): Promise<Response> {
  const key = url.pathname.slice('/data/'.length)
  if (!key) return new Response('Not found', { status: 404 })
  const obj = await env.DATA.get(key)
  if (!obj) return new Response('Not found', { status: 404 })
  const headers = new Headers()
  obj.writeHttpMetadata(headers) // Content-Type + Cache-Control (Cloudflare tự nén khi gửi)
  headers.set('ETag', obj.httpEtag)
  // Dữ liệu nội bộ: không lập chỉ mục file dữ liệu.
  headers.set('X-Robots-Tag', 'noindex, nofollow')
  return new Response(obj.body, { headers })
}

async function readJson<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.DATA.get(key)
  return obj ? ((await obj.json()) as T) : null
}

/**
 * Trang chia sẻ một trạm `/tram/<entityId>-<slug>`: lấy index.html rồi thay meta (title,
 * description, Open Graph, Twitter) theo trạm để Zalo/Messenger hiện đúng tên + địa chỉ khi
 * gửi link. Phần còn lại do client lo (App đọc URL, mở trạm, bay tới).
 *
 * Tra trạm từ shard `seo-<gen>/<id % shards>.json` (~100 KB) trong R2 — parse cả base 4 MB
 * vượt hạn CPU Free plan.
 */
async function serveStation(url: URL, env: Env): Promise<Response> {
  // `/` thay vì `/tram/…`: lấy đúng index.html (asset SPA).
  const shell = () => env.ASSETS.fetch(new Request(new URL('/', url)))

  const id = parseStationId(url.pathname)
  if (!id) return shell()

  const manifest = await readJson<Manifest>(env, 'manifest.json')
  const seo = manifest?.seo
  const row = seo ? (await readJson<Record<string, SeoRow>>(env, `${seo.dir}/${Number(id) % seo.shards}.json`))?.[id] : undefined
  if (!row) {
    // Trạm không còn (hoặc manifest cũ chưa có shard): vẫn mở app nhưng báo 404 cho bot.
    const res = await shell()
    const headers = new Headers(res.headers)
    headers.set('X-Robots-Tag', NOINDEX)
    return new Response(res.body, { status: seo ? 404 : 200, headers })
  }

  const [name, address, flags] = row
  const path = stationPath({ entityId: id, name })
  // Slug lệch (trạm đổi tên, link gõ tay) -> một URL chuẩn duy nhất cho mỗi trạm.
  if (url.pathname !== path) return Response.redirect(new URL(path + url.search, url).toString(), 301)

  const canonical = SITE_URL + path
  const title = `${name} — Trạm sạc VinFast`
  const kind = flags & 1 ? 'Trạm sạc công cộng' : 'Trạm sạc'
  const description = `${kind} ô tô VinFast tại ${address}. Xem vị trí trên bản đồ và chỉ đường.`

  const set = (attr: string, value: string) => ({ element: (el: Element) => void el.setAttribute(attr, value) })
  const res = new HTMLRewriter()
    .on('title', { element: (el) => void el.setInnerContent(title) })
    .on('meta[name="description"]', set('content', description))
    .on('link[rel="canonical"]', set('href', canonical))
    .on('meta[property="og:title"]', set('content', title))
    .on('meta[property="og:description"]', set('content', description))
    .on('meta[property="og:url"]', set('content', canonical))
    .on('meta[name="twitter:title"]', set('content', title))
    .on('meta[name="twitter:description"]', set('content', description))
    .on('head', { element: (el) => void el.append(`<meta name="robots" content="${NOINDEX}" />`, { html: true }) })
    .transform(await shell())

  const headers = new Headers(res.headers)
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('X-Robots-Tag', NOINDEX)
  // Không cache HTML: HTML trỏ tới asset có hash, deploy mới xoá asset cũ — HTML cũ trong
  // cache sẽ thành trang trắng.
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
  return new Response(res.body, { status: 200, headers })
}
