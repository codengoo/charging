/** Xử lý chữ dùng chung (client + Worker — không đụng DOM). */

/** Hạ dấu tiếng Việt, chữ thường: "Hầm Đông" -> "ham dong". Chưa gộp khoảng trắng. */
export function stripDiacritics(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu tổ hợp
    .replace(/đ/g, 'd')
}

/** Chuỗi để tìm kiếm không phân biệt dấu. Port searchKeyOf / TextFold. */
export function foldText(s: string): string {
  return stripDiacritics(s).replace(/\s+/g, ' ').trim()
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Ném lỗi nếu không phải base64url hợp lệ. */
export function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
