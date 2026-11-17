// Phần chỉ chạy trên trình duyệt của i18n (Worker không có localStorage / location).
import { LANG, langFromPath, stripLang, withLang, type Lang } from '../i18n'
import { readStr, writeStr } from './storage'

const PREF_KEY = 'tramsac.lang'

export function savedLang(): Lang | null {
  const v = readStr(PREF_KEY)
  return v === 'vi' || v === 'en' ? v : null
}

/** Đổi ngôn ngữ: nhớ lựa chọn rồi chuyển sang cùng trang ở ngôn ngữ kia (tải lại). */
export function switchLang(lang: Lang) {
  writeStr(PREF_KEY, lang) // không lưu được thì vẫn chuyển trang
  if (lang === LANG) return
  location.assign(withLang(stripLang(location.pathname), lang) + location.search + location.hash)
}

/**
 * Lúc mở app: đặt <html lang>; nếu vào TRANG CHỦ mà người dùng đã chọn ngôn ngữ kia thì chuyển
 * sang. Chỉ trang chủ — link trạm / hành trình người khác gửi giữ đúng ngôn ngữ của link.
 * Máy tìm kiếm không có localStorage nên luôn thấy đúng URL đã yêu cầu.
 * @returns true nếu đang chuyển trang (đừng render).
 */
export function applyLangOnBoot(): boolean {
  document.documentElement.lang = LANG
  const pref = savedLang()
  const home = stripLang(location.pathname) === '/'
  if (home && pref && pref !== langFromPath(location.pathname)) {
    location.replace(withLang('/', pref) + location.search + location.hash)
    return true
  }
  return false
}
