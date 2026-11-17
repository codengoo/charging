/**
 * localStorage an toàn: chế độ riêng tư / bị chặn / đầy bộ nhớ thì đọc ra null và ghi im lặng —
 * mọi thứ lưu ở đây chỉ là tiện ích, app vẫn chạy trong phiên. MỘT chỗ duy nhất đụng
 * `localStorage` (trừ script chống nháy trong index.html).
 */

export function readStr(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** false = không ghi được. */
export function writeStr(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // bỏ qua
  }
}

/** JSON đã parse (chưa kiểm hình dạng); thiếu khoá / JSON hỏng → null. */
export function readJson(key: string): unknown {
  const raw = readStr(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): boolean {
  return writeStr(key, JSON.stringify(value))
}
