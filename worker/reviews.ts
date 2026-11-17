// Đánh giá sao + bình luận công khai cho từng trạm, lưu ở D1 (migrations/0001_reviews.sql).
//
//   GET    /api/reviews/<entityId>[?before=<next>]        điểm TB, phân bố, bài của tôi, 20 bài mới nhất
//   PUT    /api/reviews/<entityId>                        viết / sửa bài của tôi { rating, body, nickname, turnstile? }
//   DELETE /api/reviews/<entityId>                        xoá bài của tôi (409 nếu bài đang bị ẩn)
//   POST   /api/reviews/report/<reviewId>                 báo cáo { turnstile? } — đủ 3 thiết bị thì tự ẩn
//   GET    /api/admin/reviews?hidden=1|2|all              (Bearer ADMIN_TOKEN) bài bị ẩn / tất cả
//   POST   /api/admin/reviews/<id>                        { hidden: 0 | 2 } hiện lại / ẩn
//   DELETE /api/admin/reviews/<id>                        xoá hẳn
//
// Ẩn danh: máy tự sinh deviceId (header X-Device, 32 hex); chỉ lưu SHA-256(pepper:deviceId).
// Chống spam: REVIEW_LIMIT theo IP cho mọi lần ghi, lọc link / email / số điện thoại, Turnstile
// khi có TURNSTILE_SECRET (chưa có thì bỏ qua — xem README).

import { STATION_ID_RE } from '../src/lib/stationUrl'
import { sameSite } from './api'

export interface ReviewsEnv {
  /** D1 `tramsac-reviews`. Thiếu binding (chưa tạo DB) → 503. */
  REVIEWS?: D1Database
  REVIEW_LIMIT: RateLimit
  API_LIMIT: RateLimit
  DATA: R2Bucket
  /** Secret: chuỗi ngẫu nhiên trộn vào hash deviceId. */
  REVIEW_PEPPER?: string
  /** Secret: token cho /api/admin/*. */
  ADMIN_TOKEN?: string
  /** Secret Turnstile; có thì mọi lần ghi phải kèm token hợp lệ. */
  TURNSTILE_SECRET?: string
}

interface ReviewRow {
  id: number
  nickname: string
  rating: number
  body: string
  created_at: number
  updated_at: number
  hidden: number
  report_count?: number
  station_id?: string
}

const PAGE = 20
/** Số thiết bị báo cáo để bài tự ẩn. */
const REPORT_HIDE = 3
const BODY_MAX = 500
const NICK_MIN = 2
const NICK_MAX = 30
const DEVICE = /^[0-9a-f]{32}$/
/** Link, tên miền, email, số điện thoại (≥ 9 chữ số, cho phép cách bằng dấu cách / chấm / gạch). */
const BLOCKED = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|vn|net|org|info|xyz|io|me|top|link|site)\b|[\w.+-]+@[\w-]+\.\w|(?:\d[\s.-]?){9,})/i

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}
const fail = (status: number, error: string) => json({ error }, status)

function toReview(r: ReviewRow, withHidden = false) {
  return {
    id: r.id,
    nickname: r.nickname,
    rating: r.rating,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...(withHidden ? { hidden: r.hidden !== 0 } : {}),
  }
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Hash thiết bị; null = thiếu / sai header. */
async function deviceHash(req: Request, env: ReviewsEnv): Promise<string | null> {
  const d = req.headers.get('X-Device')?.toLowerCase() ?? ''
  if (!DEVICE.test(d) || !env.REVIEW_PEPPER) return null
  return sha256Hex(`${env.REVIEW_PEPPER}:${d}`)
}

async function turnstileOk(token: unknown, ip: string, env: ReviewsEnv): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true
  if (typeof token !== 'string' || !token || token.length > 2048) return false
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
  })
  const out = (await res.json().catch(() => null)) as { success?: boolean } | null
  return out?.success === true
}

/**
 * Trạm có thật không — tra shard SEO như trang /station/*. Manifest chưa có shard (bản build cũ,
 * R2 local trống) thì cho qua: thà nhận nhầm id lạ còn hơn chặn hết.
 */
async function stationExists(id: string, env: ReviewsEnv): Promise<boolean> {
  const m = await env.DATA.get('manifest.json')
  const seo = m ? ((await m.json()) as { seo?: { dir: string; shards: number } }).seo : undefined
  if (!seo) return true
  const shard = await env.DATA.get(`${seo.dir}/${Number(id) % seo.shards}.json`)
  if (!shard) return true
  return id in ((await shard.json()) as Record<string, unknown>)
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  if (Number(req.headers.get('Content-Length') ?? 0) > 8192) return null
  try {
    const o = await req.json()
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null
  } catch {
    return null
  }
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256Hex(a), sha256Hex(b)])
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i)
  return diff === 0
}

// ------------------------------------------------------------ công khai

/** Con trỏ trang `<updatedAt>_<id>` (dạng cũ chỉ `<updatedAt>` vẫn nhận). Hai bài cùng updated_at không bị bỏ sót. */
export function parseCursor(raw: string | null): { at: number; id: number } | null {
  const m = raw ? /^(\d{1,16})(?:_(\d{1,16}))?$/.exec(raw) : null
  if (!m) return null
  return { at: Number(m[1]), id: m[2] === undefined ? Number.MAX_SAFE_INTEGER : Number(m[2]) }
}

async function list(db: D1Database, stationId: string, mine: string | null, before: { at: number; id: number } | null): Promise<Response> {
  const page = db
    .prepare(
      `SELECT id, nickname, rating, body, created_at, updated_at, hidden FROM reviews
       WHERE station_id = ?1 AND hidden = 0 AND device_hash != ?2 AND (updated_at < ?3 OR (updated_at = ?3 AND id < ?4))
       ORDER BY updated_at DESC, id DESC LIMIT ${PAGE + 1}`,
    )
    .bind(stationId, mine ?? '', before?.at ?? Number.MAX_SAFE_INTEGER, before?.id ?? Number.MAX_SAFE_INTEGER)
  const stats = db
    .prepare(
      `SELECT COUNT(*) AS n, AVG(rating) AS avg,
         SUM(rating = 1) AS r1, SUM(rating = 2) AS r2, SUM(rating = 3) AS r3, SUM(rating = 4) AS r4, SUM(rating = 5) AS r5
       FROM reviews WHERE station_id = ?1 AND hidden = 0`,
    )
    .bind(stationId)
  const own = db
    .prepare('SELECT id, nickname, rating, body, created_at, updated_at, hidden FROM reviews WHERE station_id = ?1 AND device_hash = ?2')
    .bind(stationId, mine ?? '')
  const [p, s, o] = await db.batch([page, stats, own])
  const rows = p.results as unknown as ReviewRow[]
  const st = (s.results[0] ?? {}) as Record<string, number | null>
  const more = rows.length > PAGE
  const items = rows.slice(0, PAGE)
  const mineRow = mine ? ((o.results[0] as unknown as ReviewRow | undefined) ?? null) : null
  return json({
    avg: st.n ? Math.round((st.avg ?? 0) * 10) / 10 : null,
    count: st.n ?? 0,
    dist: [st.r1 ?? 0, st.r2 ?? 0, st.r3 ?? 0, st.r4 ?? 0, st.r5 ?? 0],
    mine: mineRow ? toReview(mineRow, true) : null,
    items: items.map((r) => toReview(r)),
    next: more ? `${items[items.length - 1].updated_at}_${items[items.length - 1].id}` : null,
  })
}

async function upsert(req: Request, env: ReviewsEnv, db: D1Database, stationId: string, device: string, ip: string): Promise<Response> {
  const b = await readBody(req)
  if (!b) return fail(400, 'Dữ liệu không hợp lệ')
  const rating = b.rating
  const nickname = typeof b.nickname === 'string' ? b.nickname.trim().replace(/\s+/g, ' ') : ''
  const body = typeof b.body === 'string' ? b.body.trim() : ''
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) return fail(400, 'Chọn từ 1 đến 5 sao')
  if (nickname.length < NICK_MIN || nickname.length > NICK_MAX) return fail(400, `Biệt danh dài ${NICK_MIN}–${NICK_MAX} ký tự`)
  if (body.length > BODY_MAX) return fail(400, `Bình luận tối đa ${BODY_MAX} ký tự`)
  if (BLOCKED.test(nickname) || BLOCKED.test(body)) return fail(422, 'Không đăng link, email hay số điện thoại')
  if (!(await turnstileOk(b.turnstile, ip, env))) return fail(403, 'Chưa qua bước kiểm tra chống spam, thử lại')
  if (!(await stationExists(stationId, env))) return fail(404, 'Không tìm thấy trạm')

  const now = Date.now()
  const row = await db
    .prepare(
      `INSERT INTO reviews (station_id, device_hash, nickname, rating, body, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
       ON CONFLICT (station_id, device_hash) DO UPDATE SET
         nickname = excluded.nickname, rating = excluded.rating, body = excluded.body, updated_at = excluded.updated_at
       RETURNING id, nickname, rating, body, created_at, updated_at, hidden`,
    )
    .bind(stationId, device, nickname, rating, body, now)
    .first<ReviewRow>()
  return row ? json(toReview(row, true)) : fail(500, 'Không lưu được')
}

async function report(req: Request, env: ReviewsEnv, db: D1Database, reviewId: number, device: string, ip: string): Promise<Response> {
  const b = (await readBody(req)) ?? {}
  if (!(await turnstileOk(b.turnstile, ip, env))) return fail(403, 'Chưa qua bước kiểm tra chống spam, thử lại')
  const target = await db.prepare('SELECT device_hash FROM reviews WHERE id = ?1').bind(reviewId).first<{ device_hash: string }>()
  if (!target) return fail(404, 'Không tìm thấy bài')
  if (target.device_hash === device) return fail(400, 'Không báo cáo bài của chính mình')
  const ins = await db
    .prepare('INSERT OR IGNORE INTO review_reports (review_id, device_hash, created_at) VALUES (?1, ?2, ?3)')
    .bind(reviewId, device, Date.now())
    .run()
  if (!ins.meta.changes) return json({ hidden: false, already: true })
  const row = await db
    .prepare(
      `UPDATE reviews SET report_count = report_count + 1,
         hidden = CASE WHEN hidden = 0 AND report_count + 1 >= ${REPORT_HIDE} THEN 1 ELSE hidden END
       WHERE id = ?1 RETURNING hidden`,
    )
    .bind(reviewId)
    .first<{ hidden: number }>()
  return json({ hidden: (row?.hidden ?? 0) !== 0 })
}

// ------------------------------------------------------------ admin

async function admin(req: Request, url: URL, env: ReviewsEnv, db: D1Database): Promise<Response> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!env.ADMIN_TOKEN || !auth.startsWith('Bearer ') || !(await timingSafeEqual(auth.slice(7), env.ADMIN_TOKEN))) {
    return fail(401, 'Unauthorized')
  }
  const rest = url.pathname.slice('/api/admin/reviews'.length)
  if (rest === '' || rest === '/') {
    if (req.method !== 'GET') return fail(405, 'Method not allowed')
    const h = url.searchParams.get('hidden') ?? '1'
    const where = h === 'all' ? '' : `WHERE hidden = ${h === '2' ? 2 : 1}`
    const { results } = await db
      .prepare(
        `SELECT id, station_id, nickname, rating, body, created_at, updated_at, hidden, report_count FROM reviews ${where}
         ORDER BY updated_at DESC LIMIT 100`,
      )
      .all<ReviewRow>()
    return json(results)
  }
  const id = Number(rest.slice(1))
  if (!Number.isInteger(id) || id <= 0) return fail(400, 'id không hợp lệ')
  if (req.method === 'DELETE') {
    await db.batch([
      db.prepare('DELETE FROM review_reports WHERE review_id = ?1').bind(id),
      db.prepare('DELETE FROM reviews WHERE id = ?1').bind(id),
    ])
    return new Response(null, { status: 204 })
  }
  if (req.method === 'POST') {
    const b = await readBody(req)
    const hidden = b?.hidden
    if (hidden !== 0 && hidden !== 2) return fail(400, 'hidden phải là 0 hoặc 2')
    // Hiện lại: xoá báo cáo cũ để bài không tự ẩn ngay khi có thêm một báo cáo.
    const stmts = [db.prepare('UPDATE reviews SET hidden = ?2, report_count = CASE WHEN ?2 = 0 THEN 0 ELSE report_count END WHERE id = ?1').bind(id, hidden)]
    if (hidden === 0) stmts.push(db.prepare('DELETE FROM review_reports WHERE review_id = ?1').bind(id))
    await db.batch(stmts)
    return json({ id, hidden })
  }
  return fail(405, 'Method not allowed')
}

// ------------------------------------------------------------ router

export async function serveReviews(req: Request, url: URL, env: ReviewsEnv): Promise<Response> {
  const db = env.REVIEWS
  if (!db) return fail(503, 'Chưa bật đánh giá')
  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown'
  // Admin cũng qua limiter (trước khi so token) — không cho dò token không giới hạn.
  if (url.pathname.startsWith('/api/admin/reviews')) {
    if (!(await env.REVIEW_LIMIT.limit({ key: `admin:${ip}` })).success) return fail(429, 'Too many requests')
    return admin(req, url, env, db)
  }

  if (!sameSite(req)) return fail(403, 'Không cho phép')
  const isWrite = req.method !== 'GET'
  const limiter = isWrite ? env.REVIEW_LIMIT : env.API_LIMIT
  if (!(await limiter.limit({ key: ip })).success) return fail(429, 'Thao tác quá nhanh, thử lại sau ít phút')

  try {
    const device = await deviceHash(req, env)
    if (isWrite && !device) return fail(env.REVIEW_PEPPER ? 400 : 503, env.REVIEW_PEPPER ? 'Thiếu mã thiết bị' : 'Chưa cấu hình đánh giá')

    const rest = url.pathname.slice('/api/reviews/'.length)
    if (rest.startsWith('report/')) {
      const id = Number(rest.slice('report/'.length))
      if (req.method !== 'POST' || !Number.isInteger(id) || id <= 0) return fail(400, 'Yêu cầu không hợp lệ')
      return await report(req, env, db, id, device!, ip)
    }
    // Chỉ là chữ số — không cần decodeURIComponent (vốn ném lỗi với %-mã hỏng → 500).
    const stationId = rest
    if (!STATION_ID_RE.test(stationId)) return fail(400, 'Mã trạm không hợp lệ')
    switch (req.method) {
      case 'GET':
        return await list(db, stationId, device, parseCursor(url.searchParams.get('before')))
      case 'PUT':
        return await upsert(req, env, db, stationId, device!, ip)
      case 'DELETE': {
        // Bài đang bị ẩn (báo cáo / admin) không xoá được: xoá rồi đăng lại sẽ thành bài mới hidden=0.
        const del = await db
          .prepare('DELETE FROM reviews WHERE station_id = ?1 AND device_hash = ?2 AND hidden = 0')
          .bind(stationId, device!)
          .run()
        if (!del.meta.changes) {
          const held = await db
            .prepare('SELECT 1 FROM reviews WHERE station_id = ?1 AND device_hash = ?2')
            .bind(stationId, device!)
            .first()
          if (held) return fail(409, 'Bài đang bị ẩn, không xoá được')
        }
        return new Response(null, { status: 204 })
      }
      default:
        return fail(405, 'Method not allowed')
    }
  } catch {
    return fail(500, 'Lỗi máy chủ')
  }
}
