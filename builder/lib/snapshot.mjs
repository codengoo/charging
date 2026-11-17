// @ts-check
// Stream-parse snapshot locators của VinFast (gzip), chỉ yield trạm ô tô (type 2444).
// Portable (Web Streams). KHÔNG giữ cả 72MB JSON — tách từng phần tử của mảng "data"
// bằng một bộ quét tăng dần, parse từng object rồi thả ra ngay.

const CAR = '2444'

/**
 * `charging_status` của snapshot → mã gọn. Đối chiếu với `extra_data.depot_status` của
 * get-locator: ACTIVE=Available, INACTIVE=Maintaining, UNAVAILABLE=Planned (chưa khai trương),
 * OUTOFSERVICE=OutOfService. BUSY (=AllBusy) gộp vào hoạt động: build chạy mỗi ngày một lần,
 * "hết cổng trống" lúc 02:00 sai gần cả ngày. Giá trị lạ → coi như hoạt động.
 */
// __proto__: null — chuỗi lạ như "constructor" không tra ra hàm của Object.prototype.
const STATUS = { __proto__: null, INACTIVE: 1, OUTOFSERVICE: 2, UNAVAILABLE: 3 }

function str(v) {
  return v == null ? '' : String(v)
}

/** Map object thô của VinFast → hàng base đã chuẩn hoá (hoặc null nếu không phải ô tô). */
function toRow(o) {
  if (!o || Array.isArray(o) || str(o.type) !== CAR) return null
  const id = str(o.entity_id)
  const lat = parseFloat(o.lat)
  const lng = parseFloat(o.lng)
  if (!id || Number.isNaN(lat) || Number.isNaN(lng)) return null
  const flags =
    (str(o.access_type || 'Public') === 'Public' ? 1 : 0) |
    (o.parking_fee ? 2 : 0) |
    (o.has_link ? 4 : 0)
  return {
    entityId: id,
    storeId: str(o.store_id),
    name: str(o.name),
    address: str(o.address),
    lat,
    lng,
    flags,
    availableDate: o.charging_avaiable_date ? str(o.charging_avaiable_date) : null,
    status: STATUS[str(o.charging_status)] ?? 0,
  }
}

/**
 * @param {ReadableStream<string>} textStream  luồng TEXT của snapshot (đã giải nén + decode)
 * @yields hàng base cho từng trạm ô tô
 */
export async function* streamCarStations(textStream) {
  const reader = textStream.getReader()

  let buf = ''
  let started = false // đã vào trong mảng "data"
  let depth = 0 // độ sâu ngoặc của phần tử đang quét (0 = giữa các phần tử)
  let inStr = false
  let esc = false
  let elemStart = -1
  let i = 0

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += value

    if (!started) {
      const di = buf.indexOf('"data"')
      if (di === -1) {
        if (buf.length > 1_000_000) buf = buf.slice(-200)
        continue
      }
      const br = buf.indexOf('[', di)
      if (br === -1) continue
      started = true
      buf = buf.slice(br + 1)
      i = 0
    }

    for (; i < buf.length; i++) {
      const c = buf[i]
      if (inStr) {
        if (esc) esc = false
        else if (c === '\\') esc = true
        else if (c === '"') inStr = false
        continue
      }
      if (c === '"') {
        inStr = true
        continue
      }
      if (depth === 0) {
        if (c === '{' || c === '[') {
          elemStart = i
          depth = 1
        } else if (c === ']') {
          return // hết mảng data
        }
        // dấu phẩy / khoảng trắng: bỏ qua
      } else {
        if (c === '{' || c === '[') depth++
        else if (c === '}' || c === ']') {
          depth--
          if (depth === 0) {
            const elem = buf.slice(elemStart, i + 1)
            elemStart = -1
            let obj = null
            try {
              obj = JSON.parse(elem)
            } catch {
              obj = null
            }
            const row = toRow(obj)
            if (row) yield row
          }
        }
      }
    }

    // cắt phần đã tiêu thụ để chặn bộ nhớ
    if (elemStart < 0) {
      buf = ''
      i = 0
    } else {
      buf = buf.slice(elemStart)
      i -= elemStart
      elemStart = 0
    }
  }
}
