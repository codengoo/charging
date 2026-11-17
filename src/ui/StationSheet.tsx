import { useState, type ReactNode } from 'react'
import { CalendarCheck, CalendarClock, Clock, Heart, Navigation, Phone, QrCode, Wrench } from 'lucide-react'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog'
import { Chip } from '@/components/ui/chip'
import { Button } from '@/components/ui/button'
import { group, groupsOf, type GroupBook } from '../data/groups'
import { STATUS_LABEL, statusOf } from '../data/stations'
import type { Station, StationDetail, StationPower } from '../data/types'
import { GroupGlyph } from './groupIcons'
import { ImagePreview } from './ImagePreview'
import { fmtDistance } from '@/lib/format'
import { fmtMinutes, type DriveState } from '../data/drive'
import type { LiveState } from '../data/live'
import { HistoryBox, PortsBox } from './LiveSection'
import { BatteryBox } from './BatteryControl'
import { NoteBox } from './NoteBox'
import { ReviewsSection } from './ReviewsSection'
import type { Note } from '../data/notes'
import type { BatteryReading } from '../data/battery'
import type { Vehicle } from '../data/vehicles'
import { pick } from '@/i18n'

const L = pick({
  vi: {
    changeGroups: 'Đổi nhóm đã lưu',
    saveToGroup: 'Lưu vào nhóm',
    saved: 'Đã lưu',
    save: 'Lưu',
    share: 'Chia sẻ trạm, mã QR',
    directions: 'Chỉ đường',
    public: 'Công cộng',
    private: 'Nội bộ',
    link: 'Trụ LINK',
    parking: 'Có thể mất phí gửi xe',
    reservable: 'Đặt trước được',
    photo: (i: number, name: string) => `Xem ảnh ${i} của ${name}`,
    computing: 'Đang tính quãng đường…',
    driving: (d: string) => `${d} lái xe`,
    about: ' · khoảng ',
    straight: (d: string) => `~${d} đường chim bay`,
  },
  en: {
    changeGroups: 'Change saved groups',
    saveToGroup: 'Save to group',
    saved: 'Saved',
    save: 'Save',
    share: 'Share station, QR code',
    directions: 'Directions',
    public: 'Public',
    private: 'Private',
    link: 'LINK charger',
    parking: 'Parking fee may apply',
    reservable: 'Reservable',
    photo: (i: number, name: string) => `View photo ${i} of ${name}`,
    computing: 'Calculating distance…',
    driving: (d: string) => `${d} driving`,
    about: ' · about ',
    straight: (d: string) => `~${d} straight-line`,
  },
})

interface Props {
  /** Giữ component gắn và chỉ đổi `open` — gỡ hẳn khi đóng thì mất hiệu ứng trôi xuống. */
  open: boolean
  station: Station
  book: GroupBook
  /** Số cổng + kW; undefined = trạm chưa có dữ liệu (hoặc đang tải, xem powerLoading). */
  power?: StationPower
  powerLoading?: boolean
  /** Chi tiết từ VinFast (ảnh, connector, giờ, hotline) — chỉ tải khi mở trạm. */
  detail?: StationDetail
  detailLoading?: boolean
  /** Quãng đường lái xe từ vị trí người dùng (HERE); kind 'none' = chưa có GPS. */
  drive?: DriveState
  /** Số cổng trống + lịch sử 24h từ EVCS (chỉ khi bảng mở). */
  live?: LiveState
  /** Xe đã chọn trong Cài đặt (null = chưa chọn) + % pin hiện tại, để ước tính pin khi tới. */
  vehicle: Vehicle | null
  climate: boolean
  battery: BatteryReading | null
  batteryStale: boolean
  onBattery: (pct: number) => void
  onPickCar: () => void
  /** Ghi chú cá nhân (localStorage); onNote('') = xoá. */
  note?: Note
  /** Đánh giá + bình luận công khai (useReviews ở App, chỉ tải khi bảng mở). */
  reviews: Parameters<typeof ReviewsSection>[0]['reviews']
  theme: 'light' | 'dark'
  onNote: (text: string) => void
  onOpenGroups: () => void
  onShare: () => void
  onClose: () => void
  /** Bảng con (xếp nhóm, chia sẻ), render BÊN TRONG cây hộp thoại này để vaul xếp chồng đúng. */
  children?: ReactNode
}

/** Nền chip trạng thái: chưa mở là xám (chờ), hết cổng là vàng (tạm thời), còn lại đỏ. */
const STATUS_BG = {
  busy: 'bg-[#F0A500]',
  maintaining: 'bg-[#E53935]',
  out: 'bg-[#E53935]',
  planned: 'bg-[#64748B]',
} as const

export function StationSheet({ open, station, book, power, powerLoading, detail, detailLoading, drive, live, vehicle, climate, battery, batteryStale, onBattery, onPickCar, note, onNote, reviews, theme, onOpenGroups, onShare, onClose, children }: Props) {
  const gmapsDir = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`
  const groups = groupsOf(book, station.entityId)
    .map((id) => group(book, id))
    .filter((g) => g !== undefined)
  const saved = groups.length > 0
  // Connector VinFast chính xác hơn My Maps; trạm VinFast thiếu connector thì giữ My Maps.
  const ports: StationPower | undefined =
    detail && detail.groups.length > 0 && detail.maxKw !== null
      ? { portCount: detail.portCount, maxKw: detail.maxKw, dcCount: detail.dcCount, groups: detail.groups }
      : power
  const status = statusOf(station, detail?.depotStatus)

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="pr-6 text-lg">{station.name}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-sm">
            {station.address}
          </ResponsiveDialogDescription>
          <DriveLine drive={drive} />
        </ResponsiveDialogHeader>

        <Gallery images={detail?.images} loading={detailLoading} name={station.name} />

        {/* Một hàng, vuốt ngang khi tràn (ẩn scrollbar) — bảng không cao lên vì chip. */}
        <div data-vaul-no-drag className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 no-scrollbar">
          {status !== 'active' && (
            <Chip size="sm" className={`text-white ${STATUS_BG[status]}`}>
              {status === 'planned' ? <CalendarClock /> : <Wrench />}
              {STATUS_LABEL[status]}
            </Chip>
          )}
          <Chip size="sm" variant={station.isPublic ? 'default' : 'secondary'}>
            {station.isPublic ? L.public : L.private}
          </Chip>
          {station.hasLink && <Chip size="sm">{L.link}</Chip>}
          {station.parkingFee && <Chip size="sm" variant="outline">{L.parking}</Chip>}
          {detail?.open247 && (
            <Chip size="sm" variant="outline">
              <Clock />
              24/7
            </Chip>
          )}
          {detail?.hours && (
            <Chip size="sm" variant="outline">
              <Clock />
              {detail.hours}
            </Chip>
          )}
          {detail?.reservable && (
            <Chip size="sm" variant="outline">
              <CalendarCheck />
              {L.reservable}
            </Chip>
          )}
        </div>

        {saved && (
          <button
            type="button"
            onClick={onOpenGroups}
            className="mt-3 flex flex-wrap gap-1.5 text-left"
            aria-label={L.changeGroups}
          >
            {groups.map((g) => (
              <Chip key={g.id} size="sm" variant="outline">
                <GroupGlyph group={g} />
                {g.label}
              </Chip>
            ))}
          </button>
        )}

        <NoteBox key={station.entityId} note={note} onSave={onNote} />

        <PortsBox power={ports} powerLoading={powerLoading || (!ports && detailLoading)} standards={detail?.standards} live={live} />

        <BatteryBox
          vehicle={vehicle}
          climate={climate}
          reading={battery}
          stale={batteryStale}
          onBattery={onBattery}
          drive={drive}
          power={ports}
          live={live?.live?.ports ?? null}
          onPickCar={onPickCar}
        />

        {live && <HistoryBox live={live} power={ports} />}

        {detail?.hotline && (
          <a
            href={`tel:${detail.hotline}`}
            className="mt-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Phone className="size-4 shrink-0" aria-hidden />
            Hotline {detail.hotline}
          </a>
        )}

        <ReviewsSection key={station.entityId} reviews={reviews} theme={theme} />

        <ResponsiveDialogFooter className="flex-row">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={onOpenGroups}
            aria-label={saved ? L.changeGroups : L.saveToGroup}
          >
            <Heart className={saved ? 'fill-[#E53935] text-[#E53935]' : ''} />
            {saved ? L.saved : L.save}
          </Button>
          <Button variant="outline" size="icon" className="shrink-0" aria-label={L.share} onClick={onShare}>
            <QrCode />
          </Button>
          <Button asChild variant="brand" className="flex-1 sm:flex-none">
            <a href={gmapsDir} target="_blank" rel="noreferrer">
              <Navigation />
              {L.directions}
            </a>
          </Button>
        </ResponsiveDialogFooter>
        {children}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

/**
 * Dải ảnh thật của trạm, cuộn ngang; bấm ảnh mở xem lớn ngay trong app. Đang tải thì giữ chỗ
 * (khung xám) để nội dung bên dưới không giật khi ảnh về; trạm không có ảnh thì không chiếm chỗ.
 */
function Gallery({ images, loading, name }: { images?: string[]; loading?: boolean; name: string }) {
  const [viewing, setViewing] = useState<number | null>(null)
  if (loading && !images) return <div className="mt-3 h-36 animate-pulse rounded-xl bg-muted" aria-hidden />
  if (!images?.length) return null
  const one = images.length === 1
  return (
    // data-vaul-no-drag: vuốt ngang xem ảnh không bị vaul hiểu thành kéo đóng bảng.
    // snap-mandatory: `snap-x` của Tailwind v4 mặc định proximity — thả tay giữa hai ảnh không hít.
    <div data-vaul-no-drag className="-mx-5 mt-3 flex snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
      {images.map((url, i) => (
        <button
          key={url}
          type="button"
          onClick={() => setViewing(i)}
          aria-label={L.photo(i + 1, name)}
          className={`h-36 shrink-0 cursor-zoom-in snap-start overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${one ? 'w-full' : 'w-52'}`}
        >
          <img
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        </button>
      ))}
      <ImagePreview images={images} index={viewing} title={name} onClose={() => setViewing(null)} />
    </div>
  )
}

/** "12.4 km lái xe · khoảng 18 phút" — như ngăn kéo trạm bên Android. */
function DriveLine({ drive }: { drive?: DriveState }) {
  if (!drive || drive.kind === 'none') return null
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Navigation className="size-3.5 shrink-0" aria-hidden />
      {drive.kind === 'loading' && L.computing}
      {drive.kind === 'ok' && (
        <span>
          <span className="font-semibold text-foreground">{L.driving(fmtDistance(drive.info.meters / 1000))}</span>
          {L.about}
          {fmtMinutes(drive.info.seconds)}
        </span>
      )}
      {drive.kind === 'fallback' && L.straight(fmtDistance(drive.straightKm))}
    </p>
  )
}
