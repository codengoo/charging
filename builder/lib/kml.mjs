// Stream-parse một Google My Maps KML, dựng index toạ độ → các placemark (tên + nhóm cổng sạc).
// Portable: dùng Web Streams API (chạy cả Node 18+ lẫn Cloudflare Workers).
// Chỉ giữ index nhỏ (~22k điểm × vài chục byte), KHÔNG buffer cả file 11–24MB.

/** Làm tròn toạ độ về khoá ô ~11m để ghép. */
export function coordKey(lat, lng) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

/**
 * DC hay AC theo kW, KHÔNG theo bản đồ chứa placemark: map "Nhanh DC" vẫn ghi kèm cổng AC
 * 3 / 7 / 11 kW của cùng trạm. VinFast: AC là 3 / 7 (7,4) / 11 / 22 kW; DC từ 20 kW (trừ 22).
 * Khớp cách đóng gói của app Android (assets/power-static.bin).
 */
export function isDcKw(kw) {
  return kw >= 20 && kw !== 22
}

/** Bỏ dấu, chữ thường, chỉ giữ chữ-số — so tên placemark với tên trạm VinFast. */
export function normName(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

const PLACEMARK_END = '</Placemark>'
const unescapeXml = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

/**
 * @typedef {{ lat: number, lng: number, name: string, groups: number[][] }} Placemark
 *   groups: [kW, số cổng, DC?]
 * @param {ReadableStream<Uint8Array>} byteStream  res.body của KML (text/xml, không nén)
 * @param {Map<string, Placemark[]>} index  gộp vào index có sẵn (nhiều map)
 */
export async function indexKml(byteStream, index = new Map()) {
  const reader = byteStream.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  let count = 0
  const flush = (block) => {
    const c = block.match(/<coordinates>\s*([-\d.]+),([-\d.]+)/)
    if (!c) return
    const lng = +c[1]
    const lat = +c[2]
    // "Cổng sạc" có thể NHIỀU DÒNG, mỗi dòng một mức: "1 cổng 250KW\n8 cổng 60KW\n1 cổng 11KW".
    const p = block.match(/name="C[^"]*ng s[^"]*c">\s*<value>([^<]*)</)
    if (!p) return
    const groups = []
    for (const m of p[1].matchAll(/(\d+)\s*c[^\d\n]*?([\d.]+)\s*KW/gi)) {
      const n = parseInt(m[1], 10)
      const kw = parseFloat(m[2])
      if (n > 0 && kw > 0) groups.push([kw, n, isDcKw(kw) ? 1 : 0])
    }
    if (!groups.length) return
    // <name> đầu tiên trong khối là tên placemark (ExtendedData nằm sau).
    const nm = block.match(/<name>([^<]*)<\/name>/)
    const pm = { lat, lng, name: nm ? normName(unescapeXml(nm[1])) : '', groups }
    const key = coordKey(lat, lng)
    const cur = index.get(key)
    if (cur) cur.push(pm)
    else index.set(key, [pm])
    count++
  }
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += value
    let end
    while ((end = buf.indexOf(PLACEMARK_END)) !== -1) {
      const start = buf.lastIndexOf('<Placemark>', end)
      if (start !== -1) flush(buf.slice(start, end))
      buf = buf.slice(end + PLACEMARK_END.length)
    }
    // chặn buf phình nếu chưa gặp </Placemark> (giữ đuôi hợp lý)
    if (buf.length > 2_000_000) buf = buf.slice(-100_000)
  }
  return { index, count }
}
