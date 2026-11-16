import { useState, type ReactNode } from 'react'
import { CalendarCheck, Clock, Heart, Navigation, Phone, PlugZap, QrCode, Wrench } from 'lucide-react'
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
import type { Station, StationDetail, StationPower } from '../data/types'
import { GroupGlyph } from './groupIcons'
import { ImagePreview } from './ImagePreview'

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
  onOpenGroups: () => void
  onShare: () => void
  onClose: () => void
  /** Bảng con (xếp nhóm, chia sẻ), render BÊN TRONG cây hộp thoại này để vaul xếp chồng đúng. */
  children?: ReactNode
}

export function StationSheet({ open, station, book, power, powerLoading, detail, detailLoading, onOpenGroups, onShare, onClose, children }: Props) {
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
  const closed = detail?.depotStatus === 'Maintaining' || detail?.depotStatus === 'OutOfService'

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="pr-6 text-lg">{station.name}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-sm">
            {station.address}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <Gallery images={detail?.images} loading={detailLoading} name={station.name} />

        {/* Một hàng, vuốt ngang khi tràn (ẩn scrollbar) — bảng không cao lên vì chip. */}
        <div data-vaul-no-drag className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 no-scrollbar">
          {closed && (
            <Chip size="sm" className="bg-[#E53935] text-white">
              <Wrench />
              {detail?.depotStatus === 'Maintaining' ? 'Đang bảo trì' : 'Ngừng hoạt động'}
            </Chip>
          )}
          <Chip size="sm" variant={station.isPublic ? 'default' : 'secondary'}>
            {station.isPublic ? 'Công cộng' : 'Nội bộ'}
          </Chip>
          {station.hasLink && <Chip size="sm">Trụ LINK</Chip>}
          {station.parkingFee && <Chip size="sm" variant="outline">Có thể mất phí gửi xe</Chip>}
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
              Đặt trước được
            </Chip>
          )}
        </div>

        {saved && (
          <button
            type="button"
            onClick={onOpenGroups}
            className="mt-3 flex flex-wrap gap-1.5 text-left"
            aria-label="Đổi nhóm đã lưu"
          >
            {groups.map((g) => (
              <Chip key={g.id} size="sm" variant="outline">
                <GroupGlyph group={g} />
                {g.label}
              </Chip>
            ))}
          </button>
        )}

        <PowerBlock power={ports} loading={powerLoading || (!ports && detailLoading)} standards={detail?.standards} />

        {detail?.hotline && (
          <a
            href={`tel:${detail.hotline}`}
            className="mt-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Phone className="size-4 shrink-0" aria-hidden />
            Hotline {detail.hotline}
          </a>
        )}

        <ResponsiveDialogFooter className="flex-row">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={onOpenGroups}
            aria-label={saved ? 'Đổi nhóm đã lưu' : 'Lưu vào nhóm'}
          >
            <Heart className={saved ? 'fill-[#E53935] text-[#E53935]' : ''} />
            {saved ? 'Đã lưu' : 'Lưu'}
          </Button>
          <Button variant="outline" size="icon" className="shrink-0" aria-label="Chia sẻ trạm, mã QR" onClick={onShare}>
            <QrCode />
          </Button>
          <Button asChild variant="brand" className="flex-1 sm:flex-none">
            <a href={gmapsDir} target="_blank" rel="noreferrer">
              <Navigation />
              Chỉ đường
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
          aria-label={`Xem ảnh ${i + 1} của ${name}`}
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

/**
 * Khối "Cổng sạc": tổng số cổng + công suất tối đa, rồi từng mức kW. Ưu tiên connector từ
 * VinFast (lúc mở trạm); chưa có thì dùng bản ghép Google My Maps theo toạ độ (~89% trạm) —
 * không khớp nguồn nào thì nói rõ là chưa có, không đoán.
 */
function PowerBlock({ power, loading, standards }: { power?: StationPower; loading?: boolean; standards?: string[] }) {
  return (
    <section className="mt-3 rounded-xl bg-muted px-3 py-2.5" aria-label="Cổng sạc">
      <div className="flex items-center gap-2 text-sm">
        <PlugZap className="size-4 shrink-0 text-brand" aria-hidden />
        {power ? (
          <span>
            <span className="font-semibold">{power.portCount} cổng</span>
            <span className="text-muted-foreground"> · tối đa {fmtKw(power.maxKw)} kW</span>
            {standards && standards.length > 0 && (
              <span className="text-muted-foreground"> · {standards.join(', ')}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {loading ? 'Đang tải số cổng…' : 'Chưa có thông tin cổng sạc cho trạm này.'}
          </span>
        )}
      </div>
      {power && power.groups.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {power.groups.map((g) => (
            <Chip key={`${g.kw}-${g.dc}`} size="sm" variant="outline">
              <span className="font-semibold">{fmtKw(g.kw)} kW</span>
              <span className="text-muted-foreground">× {g.count} · {g.dc ? 'DC' : 'AC'}</span>
            </Chip>
          ))}
        </div>
      )}
    </section>
  )
}

function fmtKw(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}
