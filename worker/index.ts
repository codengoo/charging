// Worker tramsac: phục vụ /data/* từ R2 (JSON thô, Cloudflare tự nén), preview link /station/*,
// chi tiết trạm /api/station/* (proxy get-locator VinFast), proxy HERE + link rút gọn
// /api/{route,geocode,revgeocode,maps-link} (worker/api.ts), còn lại static assets.
// Build dữ liệu KHÔNG ở đây — chạy bằng GitHub Action (.github/workflows/build-data.yml)
// vì Workers Free plan giới hạn 10ms CPU, không đủ cho parse 72MB snapshot.
import { SITE_URL, STATION_PREFIX, parseStationId, stationPath } from '../src/lib/stationUrl'
import { serveStationDetail } from './locator'
import { serveApi, type ApiEnv } from './api'
import { langFromPath, pickFor, stripLang, withLang, type Lang } from '../src/i18n'

interface Env extends ApiEnv {
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
    if (url.pathname.startsWith('/api/station/')) return serveStationDetail(url, env.DATA, ctx, req.cf?.colo as string | undefined)
    if (url.pathname.startsWith('/api/')) return serveApi(req, url, env)
    if (url.pathname.startsWith('/data/')) return serveData(url, env)
    // Path cũ (QR đã in, link đã gửi) -> path tiếng Anh. 301 để trình duyệt/bot nhớ luôn.
    if (url.pathname === '/tram' || url.pathname.startsWith('/tram/')) {
      const rest = url.pathname.slice('/tram'.length)
      return Response.redirect(new URL('/station' + rest + url.search, url).toString(), 301)
    }
    // Tiếng Anh dưới /en: cùng app, meta + lang + hreflang viết lại theo ngôn ngữ.
    const lang = langFromPath(url.pathname)
    const path = stripLang(url.pathname)
    if (path.startsWith(STATION_PREFIX)) return serveStation(url, env, lang)
    if (lang === 'en') {
      // /en (không gạch chéo) → /en/ : một URL chuẩn cho trang chủ tiếng Anh.
      if (url.pathname === '/en') return Response.redirect(new URL('/en/' + url.search, url).toString(), 301)
      return serveShell(url, env, 'en')
    }
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

/** Meta trang chủ theo ngôn ngữ. Bản tiếng Việt nằm sẵn trong index.html; giữ hai bên khớp. */
const HOME = {
  vi: {
    title: 'Bản đồ trạm sạc ô tô VinFast — tìm trạm gần bạn',
    description:
      'Bản đồ trạm sạc ô tô VinFast trên toàn quốc, cập nhật hằng ngày. Tìm trạm gần bạn, lưu trạm theo nhóm, chia sẻ bằng mã QR và chỉ đường nhanh.',
    siteName: 'Bản đồ trạm sạc VinFast',
    locale: 'vi_VN',
  },
  en: {
    title: 'VinFast EV Charging Station Map — find stations near you',
    description:
      'Map of VinFast EV charging stations across Vietnam, updated daily. Find stations near you, see free ports in real time, plan stops along your route and get directions.',
    siteName: 'VinFast Charging Map',
    locale: 'en_US',
  },
}

interface PageMeta {
  lang: Lang
  title: string
  description: string
  /** Đường dẫn gốc (dạng tiếng Việt, không tiền tố) — dựng canonical + hreflang cho cả hai bản. */
  basePath: string
  noindex?: boolean
}

/**
 * Viết lại <html lang>, title, description, canonical, Open Graph, Twitter và thêm
 * `<link rel="alternate" hreflang>` cho vi / en / x-default — để máy tìm kiếm hiểu hai URL là
 * hai bản dịch của nhau chứ không phải nội dung trùng lặp.
 */
function localize(res: Response, m: PageMeta): Response {
  const canonical = SITE_URL + withLang(m.basePath, m.lang)
  const alt = (l: Lang) => SITE_URL + withLang(m.basePath, l)
  const home = HOME[m.lang]
  const set = (attr: string, value: string) => ({ element: (el: Element) => void el.setAttribute(attr, value) })
  const links =
    `<link rel="alternate" hreflang="vi" href="${alt('vi')}" />` +
    `<link rel="alternate" hreflang="en" href="${alt('en')}" />` +
    `<link rel="alternate" hreflang="x-default" href="${alt('vi')}" />` +
    `<meta property="og:locale:alternate" content="${m.lang === 'vi' ? 'en_US' : 'vi_VN'}" />` +
    (m.noindex ? `<meta name="robots" content="${NOINDEX}" />` : '')
  return new HTMLRewriter()
    .on('html', set('lang', m.lang))
    .on('title', { element: (el) => void el.setInnerContent(m.title) })
    .on('meta[name="description"]', set('content', m.description))
    .on('link[rel="canonical"]', set('href', canonical))
    // hreflang tĩnh của index.html chỉ đúng cho trang chủ — bỏ, thêm bộ đúng cho trang này.
    .on('link[rel="alternate"][hreflang]', { element: (el) => void el.remove() })
    .on('meta[property="og:title"]', set('content', m.title))
    .on('meta[property="og:description"]', set('content', m.description))
    .on('meta[property="og:url"]', set('content', canonical))
    .on('meta[property="og:site_name"]', set('content', home.siteName))
    .on('meta[property="og:locale"]', set('content', home.locale))
    .on('meta[name="twitter:title"]', set('content', m.title))
    .on('meta[name="twitter:description"]', set('content', m.description))
    .on('head', { element: (el) => void el.append(links, { html: true }) })
    .transform(res)
}

function htmlResponse(res: Response, status: number, noindex: boolean): Response {
  const headers = new Headers(res.headers)
  headers.set('Content-Type', 'text/html; charset=utf-8')
  if (noindex) headers.set('X-Robots-Tag', NOINDEX)
  // Không cache HTML: HTML trỏ tới asset có hash, deploy mới xoá asset cũ — HTML cũ trong
  // cache sẽ thành trang trắng.
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
  return new Response(res.body, { status, headers })
}

/** index.html (asset SPA) — mọi trang đều là cùng một app. */
const shellOf = (url: URL, env: Env) => env.ASSETS.fetch(new Request(new URL('/', url)))

/**
 * Trang tiếng Anh không phải trang trạm (`/en/`, `/en/trip`, …): index.html với meta tiếng Anh.
 * Chỉ trang chủ `/en/` được lập chỉ mục; trang con của app (trip…) noindex như bản tiếng Việt
 * không có nội dung riêng.
 */
async function serveShell(url: URL, env: Env, lang: Lang): Promise<Response> {
  const basePath = stripLang(url.pathname)
  const isHome = basePath === '/'
  const home = HOME[lang]
  const res = localize(await shellOf(url, env), {
    lang,
    title: home.title,
    description: home.description,
    basePath: isHome ? '/' : basePath,
    noindex: !isHome,
  })
  return htmlResponse(res, 200, !isHome)
}

/**
 * Trang chia sẻ một trạm `[/en]/station/<entityId>-<slug>`: lấy index.html rồi thay meta theo
 * trạm + ngôn ngữ để Zalo/Messenger hiện đúng tên + địa chỉ khi gửi link. Phần còn lại do client
 * lo (App đọc URL, mở trạm, bay tới). Trang trạm KHÔNG cho lập chỉ mục (xem NOINDEX).
 *
 * Tra trạm từ shard `seo-<gen>/<id % shards>.json` (~100 KB) trong R2 — parse cả base 4 MB
 * vượt hạn CPU Free plan.
 */
async function serveStation(url: URL, env: Env, lang: Lang): Promise<Response> {
  const id = parseStationId(url.pathname)
  if (!id) return lang === 'en' ? serveShell(url, env, lang) : shellOf(url, env)

  const manifest = await readJson<Manifest>(env, 'manifest.json')
  const seo = manifest?.seo
  const row = seo ? (await readJson<Record<string, SeoRow>>(env, `${seo.dir}/${Number(id) % seo.shards}.json`))?.[id] : undefined
  if (!row) {
    // Trạm không còn (hoặc manifest cũ chưa có shard): vẫn mở app nhưng báo 404 cho bot.
    return htmlResponse(await shellOf(url, env), seo ? 404 : 200, true)
  }

  const [name, address, flags] = row
  const path = stationPath({ entityId: id, name }, lang)
  // Slug lệch (trạm đổi tên, link gõ tay) -> một URL chuẩn duy nhất cho mỗi trạm.
  if (url.pathname !== path) return Response.redirect(new URL(path + url.search, url).toString(), 301)

  const pub = (flags & 1) === 1
  const t = pickFor(lang, {
    vi: {
      title: `${name} — Trạm sạc VinFast`,
      description: `${pub ? 'Trạm sạc công cộng' : 'Trạm sạc'} ô tô VinFast tại ${address}. Xem vị trí, cổng trống và chỉ đường.`,
    },
    en: {
      title: `${name} — VinFast charging station`,
      description: `${pub ? 'Public VinFast EV charging station' : 'VinFast EV charging station'} at ${address}. See location, free ports and directions.`,
    },
  })
  const res = localize(await shellOf(url, env), {
    lang,
    title: t.title,
    description: t.description,
    basePath: stationPath({ entityId: id, name }, 'vi'),
    noindex: true,
  })
  return htmlResponse(res, 200, true)
}
