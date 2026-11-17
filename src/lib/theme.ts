// Giao diện sáng / tối: class `dark` trên <html> (token màu ở src/index.css). Lựa chọn nằm trong
// Settings (`theme`); index.html có một đoạn script nhỏ đặt class TRƯỚC khi app nạp để khỏi
// nháy trắng — giữ hai bên cùng khoá localStorage và cùng cách đọc.
import { useEffect, useState } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
export const THEME_PREFS: ThemePref[] = ['system', 'light', 'dark']

const DARK_QUERY = '(prefers-color-scheme: dark)'

function systemDark(): boolean {
  try {
    return matchMedia(DARK_QUERY).matches
  } catch {
    return false
  }
}

/** Theme đang thật sự hiển thị: 'system' đổi theo máy, kể cả khi người dùng đổi lúc app đang mở. */
export function useResolvedTheme(pref: ThemePref): 'light' | 'dark' {
  const [sysDark, setSysDark] = useState(systemDark)
  useEffect(() => {
    if (pref !== 'system') return
    const mq = matchMedia(DARK_QUERY)
    const on = () => setSysDark(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [pref])
  const dark = pref === 'dark' || (pref === 'system' && sysDark)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])
  return dark ? 'dark' : 'light'
}
