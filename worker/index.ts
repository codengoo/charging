// Worker tramsac: phục vụ /data/* từ R2 (JSON thô, Cloudflare tự nén), preview link /station/*,
// chi tiết trạm /api/station/* (proxy get-locator VinFast), proxy HERE + link rút gọn
// /api/{route,geocode,revgeocode,maps-link} (worker/api.ts), còn lại static assets.
// Build dữ liệu KHÔNG ở đây — chạy bằng GitHub Action (.github/workflows/build-data.yml)
// vì Workers Free plan giới hạn 10ms CPU, không đủ cho parse 72MB snapshot.
import { SITE_URL, STATION_PREFIX, parseStationId, stationPath } from '../src/lib/stationUrl'
import { langFromPath, pickFor, stripLang, withLang, type Lang } from '../src/i18n'
import { serveApi, type ApiEnv } from './api'
import { checkGuard, type Guard } from './http'
import { serveStationDetail } from './locator'
import { lookupSeoRow } from './manifest'
import { serveReviews, type ReviewsEnv } from './reviews'

interface Env extends ApiEnv, ReviewsEnv {
  DATA: R2Bucket
  ASSETS: Fetcher
  STATION_LIMIT: RateLimit
}

/**
 * Trang trạm KHÔNG cho máy tìm kiếm lập chỉ mục — dữ liệu trạm là nội bộ, link chỉ để chia
 * sẻ. Đặt cả header lẫn thẻ meta: một số bot chỉ đọc một trong hai. Không chặn bằng
 * robots.txt, vì bot bị chặn thì không đọc được noindex và vẫn có thể liệt kê URL trần.
 */
const NOINDEX = 'noindex, nofollow, noarchive'

interface Route {
  prefix: string
  /** Guard chung (same-site, rate limit) chạy trước handler; reviews tự lo vì admin/ghi/đọc khác luật. */
  guard?: (env: Env) => Guard
  handle: (req: Request, url: URL, env: Env, ctx: ExecutionContext) => Promise<Response>
}

/** Xét theo thứ tự — tiền tố cụ thể đứng trước `/api/`. */
const ROUTES: Route[] = [
  {
    // Mỗi lần trượt cache tốn tới 6 lượt gọi VinFast — không cho người ngoài quét id.
    prefix: '/api/station/',
    guard: (env) => ({ site: true, limit: env.STATION_LIMIT }),
    handle: (req, url, env, ctx) => serveStationDetail(url, env.DATA, ctx, req.cf?.colo as string | undefined),
  },
  // Đánh giá nhận cả PUT/POST/DELETE — đi trước serveApi (chỉ nhận GET).
  { prefix: '/api/reviews/', handle: (req, url, env) => serveReviews(req, url, env) },
  { prefix: '/api/admin/', handle: (req, url, env) => serveReviews(req, url, env) },
  { prefix: '/api/', guard: (env) => ({ site: true, limit: env.API_LIMIT }), handle: serveApi },
  { prefix: '/data/', handle: (_req, url, env) => serveData(url, env) },
]

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    const route = ROUTES.find((r) => url.pathname.startsWith(r.prefix))
    if (route) {
      const blocked = route.guard ? await checkGuard(req, route.guard(env)) : null
      return blocked ?? route.handle(req, url, env, ctx)
    }
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

/**
 * Meta + khối chữ tĩnh + JSON-LD trang chủ theo ngôn ngữ. Bản tiếng Việt nằm sẵn trong index.html
 * (title, description, #seo-shell, script#ld-app); GIỮ HAI BÊN KHỚP.
 */
const HOME = {
  vi: {
    title: 'Bản đồ trạm sạc ô tô VinFast — tìm trạm gần bạn',
    description:
      'Bản đồ trạm sạc ô tô VinFast toàn quốc, cập nhật hằng ngày: cổng trống thời gian thực, trạm dọc đường từ link Google Maps, tự lên kế hoạch dừng sạc theo xe và chỉ đường.',
    siteName: 'Bản đồ trạm sạc VinFast',
    locale: 'vi_VN',
    h1: 'Bản đồ trạm sạc ô tô VinFast',
    features: [
      'Hơn 25.000 trạm sạc VinFast trên toàn quốc, cập nhật hằng ngày.',
      'Số cổng trống theo thời gian thực và biểu đồ độ đông 24 giờ.',
      'Dán link chỉ đường Google Maps để thấy trạm dọc đường.',
      'Tự lên kế hoạch dừng sạc theo mẫu xe và % pin.',
      'Lưu Nhà, Công ty, trạm yêu thích; dùng được khi mất sóng.',
    ],
    appFeatures: [
      'Bản đồ hơn 25.000 trạm sạc ô tô VinFast trên toàn quốc',
      'Số cổng trống theo thời gian thực',
      'Trạm sạc dọc đường từ link chỉ đường Google Maps',
      'Tự lên kế hoạch dừng sạc theo mẫu xe',
      'Lưu Nhà, Công ty và trạm yêu thích',
      'Dùng được khi mất sóng',
    ],
  },
  en: {
    title: 'VinFast EV Charging Station Map — find stations near you',
    description:
      'Map of VinFast EV charging stations across Vietnam, updated daily: real-time free ports, stations along a Google Maps route, automatic charging stops for your car, and directions.',
    siteName: 'VinFast Charging Map',
    locale: 'en_US',
    h1: 'VinFast EV charging station map',
    features: [
      'Over 25,000 VinFast charging stations across Vietnam, updated daily.',
      'Real-time free ports and a 24-hour busyness chart.',
      'Paste a Google Maps directions link to see stations along the way.',
      'Automatic charging stops for your car model and battery level.',
      'Save Home, Work and favourite stations; works without signal.',
    ],
    appFeatures: [
      'Map of over 25,000 VinFast EV charging stations in Vietnam',
      'Real-time free charging ports',
      'Charging stations along a Google Maps route',
      'Automatic charging stop planning by car model',
      'Save Home, Work and favourite stations',
      'Works offline',
    ],
  },
}

/** JSON-LD (schema.org WebSite + WebApplication) cho trang chủ một ngôn ngữ. */
function appJsonLd(lang: Lang): string {
  const h = HOME[lang]
  const url = SITE_URL + withLang('/', lang)
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url, name: h.siteName, inLanguage: lang },
      {
        '@type': 'WebApplication',
        '@id': `${SITE_URL}/#app`,
        name: h.siteName,
        url,
        description: h.description,
        applicationCategory: 'TravelApplication',
        operatingSystem: 'Web, iOS, Android',
        inLanguage: lang,
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
        featureList: h.appFeatures,
      },
    ],
  }).replace(/</g, '\\u003c') // không để chuỗi dữ liệu đóng thẻ <script>
}

const escHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

interface PageMeta {
  lang: Lang
  title: string
  description: string
  /** Đường dẫn gốc (dạng tiếng Việt, không tiền tố) — dựng canonical + hreflang cho cả hai bản. */
  basePath: string
  noindex?: boolean
  /** Khối chữ tĩnh (#seo-shell): tiêu đề h1 + đoạn mở đầu; `features` null = bỏ danh sách (trang trạm). */
  h1: string
  lead: string
  features: string[] | null
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
    // Khối chữ tĩnh cho bot không chạy JS + dữ liệu cấu trúc theo ngôn ngữ.
    .on('#seo-h1', { element: (el) => void el.setInnerContent(m.h1) })
    .on('#seo-lead', { element: (el) => void el.setInnerContent(m.lead) })
    .on('#seo-features', {
      element: (el) =>
        m.features ? void el.setInnerContent(m.features.map((f) => `<li>${escHtml(f)}</li>`).join(''), { html: true }) : void el.remove(),
    })
    .on('script#ld-app', { element: (el) => void el.setInnerContent(appJsonLd(m.lang), { html: true }) })
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
    h1: home.h1,
    lead: home.description,
    features: home.features,
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

  const { row, noIndex } = await lookupSeoRow(env.DATA, id)
  if (!row) {
    // Trạm không còn (hoặc manifest cũ chưa có shard): vẫn mở app nhưng báo 404 cho bot.
    return htmlResponse(await shellOf(url, env), noIndex ? 200 : 404, true)
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
    h1: name,
    lead: t.description,
    features: null,
  })
  return htmlResponse(res, 200, true)
}
