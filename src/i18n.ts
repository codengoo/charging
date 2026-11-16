/**
 * Hai ngôn ngữ vi / en theo ĐƯỜNG DẪN: tiếng Việt ở gốc (`/`, `/station/…`, `/trip`), tiếng
 * Anh dưới tiền tố `/en` (`/en/`, `/en/station/…`, `/en/trip`). Mỗi ngôn ngữ một URL riêng —
 * điều kiện để máy tìm kiếm lập chỉ mục được cả hai (Worker viết lại meta + hreflang theo URL,
 * xem worker/index.ts).
 *
 * Ngôn ngữ CỐ ĐỊNH trong một lần tải trang: đổi ngôn ngữ là chuyển sang URL kia (tải lại),
 * nên chuỗi chỉ cần chọn một lần lúc nạp module — không cần context React.
 *
 * Cách dùng trong một file:
 *   const L = pick({
 *     vi: { title: 'Trạm gần bạn', count: (n: number) => `${n} trạm` },
 *     en: { title: 'Stations near you', count: (n: number) => `${n} stations` },
 *   })
 *   … L.title … L.count(3)
 *
 * File này cũng được Worker import (không có `location`/`localStorage`) — chỉ đọc qua globalThis.
 */

export type Lang = 'vi' | 'en'
export const LANGS: Lang[] = ['vi', 'en']

const EN_PREFIX = /^\/en(?=\/|$)/

export function langFromPath(pathname: string): Lang {
  return EN_PREFIX.test(pathname) ? 'en' : 'vi'
}

/** `/en/station/1-x` → `/station/1-x`; `/en` → `/`. Đường dẫn tiếng Việt giữ nguyên. */
export function stripLang(pathname: string): string {
  return pathname.replace(EN_PREFIX, '') || '/'
}

/** Thêm tiền tố ngôn ngữ cho một đường dẫn gốc (dạng tiếng Việt). */
export function withLang(path: string, lang: Lang): string {
  if (lang === 'vi') return path
  return path === '/' ? '/en/' : `/en${path}`
}

const loc = (globalThis as { location?: { pathname: string } }).location

/** Ngôn ngữ của trang đang mở. Worker luôn 'vi' — ở đó truyền lang tường minh. */
export const LANG: Lang = loc ? langFromPath(loc.pathname) : 'vi'

/** Locale cho Intl / toLocaleString. */
export const LOCALE = LANG === 'en' ? 'en-US' : 'vi-VN'

/** Chọn bộ chuỗi theo ngôn ngữ trang. `en` phải cùng kiểu với `vi` (thiếu khoá là lỗi biên dịch). */
export function pick<T>(d: { vi: T; en: NoInfer<T> }): T {
  return d[LANG]
}

/** Chọn bộ chuỗi theo ngôn ngữ chỉ định (Worker). */
export function pickFor<T>(lang: Lang, d: { vi: T; en: NoInfer<T> }): T {
  return d[lang]
}

