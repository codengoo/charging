/**
 * Trang chia sẻ một trạm: `/tram/<entityId>-<slug>`.
 *
 * App vẫn là SPA tĩnh — Function này chỉ lấy `index.html` rồi thay thẻ meta (title,
 * description, Open Graph, Twitter) theo trạm, để app nhắn tin (Zalo, Messenger…) hiện
 * đúng tên + địa chỉ khi gửi link. Trang trạm đánh dấu noindex — xem [NOINDEX]. Phần còn
 * lại do client lo: App đọc URL, mở trạm và bay tới.
 *
 * Dữ liệu tra từ shard `/seo/<id % 128>.json` do seo.plugin.ts sinh lúc build.
 */
import { SITE_URL, parseStationId, seoShardOf, stationPath } from '../../src/lib/stationUrl'

interface Env {
  ASSETS: { fetch: (req: Request | string | URL) => Promise<Response> }
}

interface Ctx {
  request: Request
  env: Env
}

/** [name, address, flags] — xem seo.plugin.ts. */
type SeoRow = [string, string, number]

/**
 * Trang trạm KHÔNG cho máy tìm kiếm lập chỉ mục — dữ liệu trạm là nội bộ, link chỉ để chia
 * sẻ. Đặt cả header lẫn thẻ meta: một số bot chỉ đọc một trong hai. Không chặn bằng
 * robots.txt, vì bot bị chặn thì không đọc được noindex và vẫn có thể liệt kê URL trần.
 */
const NOINDEX = 'noindex, nofollow, noarchive'
const NOINDEX_META = `<meta name="robots" content="${NOINDEX}" />`

declare const HTMLRewriter: {
  new (): {
    on(selector: string, handler: { element?: (el: SeoElement) => void }): InstanceType<typeof HTMLRewriter>
    transform(res: Response): Response
  }
}
interface SeoElement {
  setAttribute(name: string, value: string): void
  setInnerContent(content: string): void
  append(content: string, opts?: { html: boolean }): void
}

export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const url = new URL(request.url)
  // `/` chứ không `/index.html`: Pages chuyển 308 `/index.html` -> `/`.
  const shell = () => env.ASSETS.fetch(new URL('/', url))

  const id = parseStationId(url.pathname)
  if (!id) return shell()

  const shardRes = await env.ASSETS.fetch(new URL(`/seo/${seoShardOf(id)}.json`, url))
  const row = shardRes.ok ? ((await shardRes.json()) as Record<string, SeoRow>)[id] : undefined
  if (!row) {
    // Trạm không còn: vẫn mở app (người dùng thấy bản đồ) nhưng báo 404 cho bot.
    const res = await shell()
    const headers = new Headers(res.headers)
    headers.set('X-Robots-Tag', NOINDEX)
    return new Response(res.body, { status: 404, headers })
  }

  const [name, address, flags] = row
  const path = stationPath({ entityId: id, name })
  // Slug lệch (trạm đổi tên, link gõ tay) -> một URL chuẩn duy nhất cho mỗi trạm.
  if (url.pathname !== path) return Response.redirect(new URL(path + url.search, url).toString(), 301)

  const canonical = SITE_URL + path
  const title = `${name} — Trạm sạc VinFast`
  const kind = flags & 1 ? 'Trạm sạc công cộng' : 'Trạm sạc'
  const description = `${kind} ô tô VinFast tại ${address}. Xem vị trí trên bản đồ và chỉ đường.`

  // Chỉ meta cho PREVIEW khi gửi link (Zalo, Messenger đọc og:* bất kể noindex). Không
  // JSON-LD / toạ độ: dữ liệu trạm là nội bộ, không mời máy tìm kiếm thu thập.
  const set = (attr: string, value: string) => ({ element: (el: SeoElement) => el.setAttribute(attr, value) })
  const res = new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(title) })
    .on('meta[name="description"]', set('content', description))
    .on('link[rel="canonical"]', set('href', canonical))
    .on('meta[property="og:title"]', set('content', title))
    .on('meta[property="og:description"]', set('content', description))
    .on('meta[property="og:url"]', set('content', canonical))
    .on('meta[name="twitter:title"]', set('content', title))
    .on('meta[name="twitter:description"]', set('content', description))
    .on('head', { element: (el) => el.append(NOINDEX_META, { html: true }) })
    .transform(await shell())

  const headers = new Headers(res.headers)
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('X-Robots-Tag', NOINDEX)
  // Không cache HTML: HTML trỏ tới asset có hash, deploy mới xoá asset cũ — HTML cũ trong
  // cache sẽ thành trang trắng. Function chỉ đọc một shard ~30 KB nên chạy lại mỗi lần vẫn rẻ.
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
  return new Response(res.body, { status: 200, headers })
}
