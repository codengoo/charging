// Tiện ích HTTP dùng chung cho mọi route của Worker: trả JSON, lỗi, IP, decode an toàn,
// guard same-site + rate limit, đọc JSON từ R2.

export const NO_STORE = 'no-store'

/** JSON từ object. `cache` là nguyên giá trị Cache-Control (mặc định no-store). */
export function json(data: unknown, status = 200, cache = NO_STORE, extra?: HeadersInit): Response {
  return jsonText(JSON.stringify(data), status, cache, extra)
}

/** JSON đã là chuỗi (body upstream trả nguyên văn — không parse lại, Free plan 10 ms CPU). */
export function jsonText(body: BodyInit, status = 200, cache = NO_STORE, extra?: HeadersInit): Response {
  const headers = new Headers(extra)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', cache)
  return new Response(body, { status, headers })
}

/** `{ error }` + no-store — lỗi không bao giờ được cache ở trình duyệt. */
export const fail = (status: number, error: string): Response => json({ error }, status)

export const clientIp = (req: Request): string => req.headers.get('CF-Connecting-IP') ?? 'unknown'

/** %-mã hỏng (`%E0%A4`) làm decodeURIComponent ném lỗi — trả null để route báo 400. */
export function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s)
  } catch {
    return null
  }
}

const SITE_HOSTS = new Set(['charging.cangao.asia', 'localhost', '127.0.0.1'])

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

export interface Guard {
  /** Chỉ nhận request từ chính trang. */
  site?: boolean
  /** Giới hạn theo IP. */
  limit?: RateLimit
  /** Câu báo khi vượt giới hạn. */
  limitMsg?: string
}

/** null = cho qua; ngược lại là response chặn (403 / 429). */
export async function checkGuard(req: Request, g: Guard): Promise<Response | null> {
  if (g.site && !sameSite(req)) return fail(403, 'Không cho phép')
  if (g.limit && !(await g.limit.limit({ key: clientIp(req) })).success) {
    return fail(429, g.limitMsg ?? 'Gọi quá nhanh, thử lại sau ít phút')
  }
  return null
}

export async function readR2Json<T>(bucket: R2Bucket, key: string): Promise<T | null> {
  const obj = await bucket.get(key)
  return obj ? ((await obj.json()) as T) : null
}
