import type { GeoPoint } from './geo'
/**
 * Giải mã "flexible polyline" của HERE. Port từ FlexiblePolyline.kt (charge-map-android).
 *
 * HERE Routing v8 trả đường đi dưới dạng một chuỗi nén chứ không phải mảng toạ độ — một tuyến
 * 300 km có hàng nghìn điểm, gửi thẳng bằng JSON thì nặng gấp chục lần.
 *
 * Định dạng (bản 1, tài liệu mở của HERE):
 *   - Bảng chữ cái 64 ký tự an toàn cho URL: A-Z a-z 0-9 _ -
 *   - Mỗi ký tự cho 6 bit: 5 bit giá trị + bit 0x20 báo "còn nữa"
 *   - Số âm dùng zigzag; toạ độ là SỐ NGUYÊN, chia cho 10^precision mới ra độ
 *   - Phần đầu: phiên bản, rồi một số gồm precision, có chiều thứ ba không và độ chính xác
 *
 * KHÔNG dùng chung với polyline của Google: Google chốt precision 5 và không có phần đầu,
 * giải bằng hàm này sẽ ra toạ độ rác chứ không báo lỗi.
 *
 * Số dùng `number` thường: toạ độ × 10^precision ≤ ~1,8e9 với precision 7 — dưới 2^53. Phép
 * bit của JS chỉ 32 bit nên varint/zigzag tính bằng nhân/chia thay vì `<<`/`>>`.
 */


/** Bảng tra ngược của bảng chữ cái, đánh số từ ký tự '-' (45). */
const TABLE = [
  62, -1, -1, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1,
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, -1, -1, -1, -1, 63, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
  36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
]

/** Trả về rỗng khi chuỗi hỏng hoặc đúng phiên bản khác — nơi gọi tự lo liệu. */
export function decodeFlexiblePolyline(encoded: string): PolylinePoint[] {
  let i = 0
  /** Đọc một số varint; null khi hết chuỗi hoặc gặp ký tự lạ. */
  const next = (): number | null => {
    let result = 0
    let mul = 1
    while (i < encoded.length) {
      const idx = encoded.charCodeAt(i++) - 45
      const v = idx < 0 || idx >= TABLE.length ? -1 : TABLE[idx]
      if (v < 0) return null
      result += (v & 0x1f) * mul
      if ((v & 0x20) === 0) return result
      mul *= 32
      if (mul > 2 ** 60) return null // tràn — chuỗi hỏng
    }
    return null
  }
  const unzigzag = (v: number) => (v % 2 === 1 ? -(v + 1) / 2 : v / 2)

  if (next() !== 1) return [] // chỉ biết đọc bản 1
  const header = next()
  if (header === null) return []
  const precision = header & 15
  const thirdDim = (header >> 4) & 7
  const thirdPrecision = (header >> 7) & 15
  const scale = 10 ** precision
  const zScale = 10 ** thirdPrecision
  // 2 = ALTITUDE, 3 = ELEVATION (mét): giữ lại thành `z`. Các loại khác (level, tuỳ ý) đọc rồi bỏ.
  const keepZ = thirdDim === 2 || thirdDim === 3

  const out: PolylinePoint[] = []
  let lat = 0
  let lng = 0
  let z = 0
  for (;;) {
    const dLat = next()
    if (dLat === null) break
    const dLng = next()
    if (dLng === null) break
    lat += unzigzag(dLat)
    lng += unzigzag(dLng)
    // Chiều thứ ba phải đọc cho hết dù không dùng tới, không thì lệch nhịp và mọi điểm sau đều sai.
    if (thirdDim !== 0) {
      const dz = next()
      if (dz === null) break
      z += unzigzag(dz)
    }
    out.push(keepZ ? { lat: lat / scale, lng: lng / scale, z: z / zScale } : { lat: lat / scale, lng: lng / scale })
  }
  return out
}

/** Điểm giải mã; `z` = độ cao (m) khi chuỗi mang chiều thứ ba là độ cao (`return=elevation`). */
export type PolylinePoint = GeoPoint & { z?: number }
