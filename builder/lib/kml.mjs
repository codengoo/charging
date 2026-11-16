// Stream-parse một Google My Maps KML, dựng index toạ độ → nhóm cổng sạc.
// Portable: dùng Web Streams API (chạy cả Node 18+ lẫn Cloudflare Workers).
// Chỉ giữ index nhỏ (~22k điểm × vài chục byte), KHÔNG buffer cả file 11–24MB.

/** Làm tròn toạ độ về khoá ô ~11m để ghép. */
export function coordKey(lat, lng) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

const PLACEMARK_END = '</Placemark>'

/**
 * @param {ReadableStream<Uint8Array>} byteStream  res.body của KML (text/xml, không nén)
 * @param {number} isDc  1 = map sạc nhanh DC, 0 = map sạc chậm AC
 * @param {Map<string,{groups:number[][]}>} index  gộp vào index có sẵn (nhiều map)
 */
export async function indexKml(byteStream, isDc, index = new Map()) {
  const reader = byteStream.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  let count = 0
  const flush = (block) => {
    const c = block.match(/<coordinates>\s*([-\d.]+),([-\d.]+)/)
    if (!c) return
    const lng = +c[1]
    const lat = +c[2]
    // "Cổng sạc": value kiểu "5 cổng 250KW"
    const p = block.match(/name="C[^"]*ng s[^"]*c">\s*<value>([^<]*)</)
    let count_, kw
    if (p) {
      const m = p[1].match(/(\d+)\s*c[^\d]*?([\d.]+)\s*KW/i)
      if (m) {
        count_ = parseInt(m[1], 10)
        kw = parseFloat(m[2])
      }
    }
    if (count_ == null || kw == null) return
    const key = coordKey(lat, lng)
    const group = [kw, count_, isDc] // [kW, số cổng, DC?]
    const cur = index.get(key)
    if (cur) cur.groups.push(group)
    else index.set(key, { groups: [group] })
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
