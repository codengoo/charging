import { useEffect, useRef, useState } from 'react'
import { decodeBackup, IMPORT_HASH, type Backup } from '../data/backup'
import type { StationIndex } from '../data/stations'
import type { Station } from '../data/types'
import type { useTrip } from '../data/useTrip'
import { LANG, pick as tr, stripLang, withLang } from '../i18n'
import { firstUrl } from '../lib/mapsLink'
import { parseStationId, readTripLink, stationPath, tripPath } from '../lib/stationUrl'

const T = tr({
  vi: { stationTitle: (name: string) => `${name} — Trạm sạc VinFast` },
  en: { stationTitle: (name: string) => `${name} — VinFast charging station` },
})

const DEFAULT_TITLE = document.title

export function readImportHash(): string | null {
  return location.hash.startsWith(IMPORT_HASH) ? location.hash.slice(IMPORT_HASH.length) : null
}

interface Args {
  index: StationIndex | null
  selected: Station | null
  tripCtl: ReturnType<typeof useTrip>
  /** Mở một trạm (chọn + bay tới). */
  pick: (st: Station) => void
  /** Link sao lưu đã giải mã (null = hỏng) → hỏi xác nhận gộp. */
  askImport: (incoming: Backup | null) => void
}

/**
 * URL ↔ trạng thái app: mở từ link trạm `/station/<id>-<slug>`, link hành trình `/trip?link=…`
 * (cả Web Share Target), link sao lưu `#import=…`; rồi giữ thanh địa chỉ + tiêu đề tab theo trạm /
 * hành trình đang mở. Mọi link đọc NGAY lúc khởi tạo — effect đồng bộ URL sẽ ghi đè pathname.
 */
export function useUrlSync({ index, selected, tripCtl, pick, askImport }: Args) {
  const [linkedId] = useState(() => parseStationId(location.pathname))
  const [tripLink] = useState(() => readTripLink(location))
  const [importHash] = useState(readImportHash)
  const { trip } = tripCtl

  // Mở từ link chia sẻ /station/<id>-<slug>: chọn trạm và bay tới ngay khi có dữ liệu (một lần).
  const linkHandled = useRef(false)
  const pickRef = useRef(pick)
  pickRef.current = pick
  useEffect(() => {
    if (!index || linkHandled.current) return
    linkHandled.current = true
    const st = linkedId ? index.byId.get(linkedId) : undefined
    if (st) pickRef.current(st)
  }, [index, linkedId])

  // Mở bằng link sao lưu: bỏ hash ngay (nhập hay huỷ cũng không để lại), rồi hỏi xác nhận.
  // Dán link vào tab ĐANG mở app chỉ đổi hash, không tải lại trang → nghe thêm hashchange.
  const askImportRef = useRef(askImport)
  askImportRef.current = askImport
  useEffect(() => {
    const handle = (payload: string | null) => {
      if (!payload) return
      history.replaceState(null, '', location.pathname + location.search)
      void decodeBackup(payload).then((b) => askImportRef.current(b))
    }
    handle(importHash)
    const onHash = () => handle(readImportHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [importHash])

  // Mở thẳng /trip: chạy hành trình khi có dữ liệu (một lần). Share target gửi cả đoạn text
  // ("Hà Nội đến Hải Phòng https://…") — chỉ giữ link để URL /trip?link=… gọn.
  // PHẢI đứng trước effect đồng bộ URL: effect đó đọc tripHandled ngay trong cùng lượt commit.
  const tripHandled = useRef(false)
  useEffect(() => {
    if (!index || tripHandled.current || tripLink === undefined) return
    tripHandled.current = true
    if (tripLink) tripCtl.open(firstUrl(tripLink) ?? tripLink)
    else tripCtl.show()
  }, [index, tripLink, tripCtl])

  // URL theo trạm đang mở: copy thanh địa chỉ là ra đúng link chia sẻ. replaceState chứ không
  // pushState — bấm qua lại nhiều trạm không làm đầy lịch sử nút Back.
  // Đang mở hành trình thì URL giữ /trip?link=… (mở trạm trong lúc đó KHÔNG đổi sang /station/…):
  // copy URL là gửi được cả hành trình.
  const tripOpen = trip.status !== 'closed'
  useEffect(() => {
    // Chưa tải xong dữ liệu thì chưa biết trạm trong link có tồn tại không — đừng đụng URL.
    if (!index) return
    // Hành trình từ link chưa kịp mở (effect trên chạy cùng lượt) — đừng ghi đè /trip.
    if (tripLink !== undefined && !tripHandled.current) return
    if (tripOpen) {
      const url = tripPath(trip.link ? (firstUrl(trip.link) ?? trip.link) : null)
      if (location.pathname + location.search !== url) history.replaceState(null, '', url)
    } else {
      const path = selected ? stationPath(selected) : withLang('/', LANG)
      // Rời /trip thì bỏ luôn ?link=…; còn lại giữ query (vd. utm_*).
      const search = stripLang(location.pathname).startsWith('/trip') ? '' : location.search
      if (location.pathname !== path || search !== location.search) history.replaceState(null, '', path + search)
    }
    document.title = selected ? T.stationTitle(selected.name) : DEFAULT_TITLE
  }, [index, selected, tripOpen, trip.link, tripLink])
}
