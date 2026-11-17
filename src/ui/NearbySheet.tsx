import { useEffect, useMemo, useState } from 'react'
import { Loader2, LocateFixed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { kwActive, kwLabel, nearestStations, passesFilters, tierOf, type Filters, type StationIndex } from '../data/stations'
import type { Station, StationPower } from '../data/types'
import { TIER_COLORS } from '../map/pins'
import { ChargerDot } from './ChargerDot'
import { fmtDistance, fmtKw } from '@/lib/format'
import { cachedDrive, type DriveInfo } from '../data/drive'
import type { GeoPoint, GpsResult } from '../lib/geo'
import { pick } from '../i18n'
import { AppSheet } from './AppSheet'
import { StationRow } from './StationRow'

const L = pick({
  vi: {
    driving: 'Quãng đường lái xe',
    straight: 'Đường chim bay',
    nearYou: 'Trạm gần bạn',
    nearCenter: 'Trạm gần tâm bản đồ',
    power: (label: string) => `công suất ${label}`,
    none: (f: string) => `Không có trạm đang hoạt động${f ? ` ${f}` : ''} trong khoảng 110 km.`,
    count: (n: number, f: string) => `${n} trạm đang hoạt động${f ? ` ${f}` : ''} gần nhất`,
    gpsHint: ' · ~ là đường chim bay, mở trạm để xem quãng đường lái xe.',
    noGpsHint: ' · Bật định vị để xếp theo chỗ bạn đứng.',
    useGps: 'Dùng vị trí của tôi',
    gpsDenied: 'Trình duyệt đang chặn vị trí. Bật lại quyền Vị trí cho trang này trong cài đặt trình duyệt / điện thoại rồi thử lại.',
    gpsFailed: 'Chưa lấy được vị trí — kiểm tra định vị của máy rồi thử lại.',
  },
  en: {
    driving: 'Driving distance',
    straight: 'Straight-line distance',
    nearYou: 'Stations near you',
    nearCenter: 'Stations near map center',
    power: (label: string) => `at ${label}`,
    none: (f: string) => `No operating stations${f ? ` ${f}` : ''} within about 110 km.`,
    count: (n: number, f: string) =>
      `${n} nearest operating ${n === 1 ? 'station' : 'stations'}${f ? ` ${f}` : ''}`,
    gpsHint: ' · ~ is straight-line; open a station to see driving distance.',
    noGpsHint: ' · Turn on location to sort by where you are.',
    useGps: 'Use my location',
    gpsDenied: 'Location is blocked for this site. Allow Location in your browser / phone settings, then try again.',
    gpsFailed: "Couldn't get your location — check your device's location services and try again.",
  },
})

/**
 * Trạm đã mở (có quãng đường lái trong cache) hiện km đường thật; còn lại là đường chim bay,
 * ghi rõ để không lẫn. Thứ tự vẫn theo chim bay — xem data/drive.ts vì sao không dùng Matrix.
 */
function Distance({ drive, straightKm }: { drive: DriveInfo | null | undefined; straightKm: number }) {
  if (drive) {
    return (
      <span className="text-sm font-semibold" title={L.driving}>
        {fmtDistance(drive.meters / 1000)}
      </span>
    )
  }
  return (
    <span className="text-sm font-semibold" title={L.straight}>
      ~{fmtDistance(straightKm)}
    </span>
  )
}

/** 20 trạm, quét tối đa 10 vòng ô lưới (~110 km). */
const LIMIT = 20
const MAX_RING = 10

interface Props {
  /** Giữ component gắn và chỉ đổi `open` — gỡ hẳn khi đóng thì mất hiệu ứng trôi xuống. */
  open: boolean
  index: StationIndex
  power: Map<string, StationPower> | null
  filters: Filters
  /** Chụp lúc mở bảng — kéo bản đồ sau bảng thì danh sách không nhảy. */
  origin: { lat: number; lng: number }
  fromGps: boolean
  /** Điểm gốc của quãng đường lái (useStableOrigin) — để mượn kết quả cache của trạm đã mở. */
  driveOrigin: GeoPoint | null
  /** Xin vị trí (chỉ hiện nút khi chưa có GPS). Thành công thì App đổi `origin` + `fromGps`. */
  onRequestGps: () => Promise<GpsResult>
  onPick: (st: Station) => void
  onClose: () => void
}


/** Các trạm đang hoạt động gần nhất, theo đúng bộ lọc công suất đang bật trên bản đồ. */
export function NearbySheet({ open, index, power, filters, origin, fromGps, driveOrigin, onRequestGps, onPick, onClose }: Props) {
  const [locating, setLocating] = useState(false)
  const [gpsError, setGpsError] = useState<GpsResult | null>(null)
  // Sheet giữ gắn khi đóng — mở lại thì bỏ lỗi GPS của lần trước.
  useEffect(() => {
    if (open) setGpsError(null)
  }, [open])

  async function requestGps() {
    setLocating(true)
    setGpsError(null)
    const r = await onRequestGps()
    setLocating(false)
    if (r !== 'ok') setGpsError(r)
  }

  const items = useMemo(() => {
    // "Đã lưu" bỏ qua ở đây (đã có bảng Danh sách); trạm không hoạt động luôn bỏ — đang cần sạc.
    const f: Filters = { ...filters, favoritesOnly: false, activeOnly: true }
    return nearestStations(index, origin.lat, origin.lng, LIMIT, (st) => passesFilters(st, f, power), MAX_RING)
  }, [index, power, filters, origin])

  const filterLabel = kwActive(filters.kw) ? L.power(kwLabel(filters.kw)) : ''

  return (
    <AppSheet
      open={open}
      onClose={onClose}
      title={fromGps ? L.nearYou : L.nearCenter}
      description={
        <>
          {items.length === 0 ? L.none(filterLabel) : L.count(items.length, filterLabel)}
          {fromGps ? L.gpsHint : L.noGpsHint}
        </>
      }
    >
      {!fromGps && (
        <div className="mt-2 flex flex-col gap-1.5">
          <Button variant="brand" size="sm" className="self-start" disabled={locating} onClick={requestGps}>
            {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />}
            {L.useGps}
          </Button>
          {gpsError && (
            <p role="alert" className="text-xs text-destructive">
              {gpsError === 'denied' ? L.gpsDenied : L.gpsFailed}
            </p>
          )}
        </div>
      )}

      <ul className="mt-2 flex flex-col">
        {items.map((st) => {
          const p = power?.get(st.entityId)
          return (
            <StationRow
              key={st.entityId}
              leading={<ChargerDot color={TIER_COLORS[tierOf(p)]} className="size-8" />}
              title={st.name}
              subtitle={st.address}
              trailing={
                <>
                  <Distance drive={fromGps ? cachedDrive(driveOrigin, st) : undefined} straightKm={st.distanceKm} />
                  {p && <span className="text-xs text-muted-foreground">{fmtKw(p.maxKw)} kW</span>}
                </>
              }
              onClick={() => onPick(st)}
            />
          )
        })}
      </ul>
    </AppSheet>
  )
}
