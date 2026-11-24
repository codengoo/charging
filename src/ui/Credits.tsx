import { useState } from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { APP_VERSION } from '../data/changelog'
import { pick } from '../i18n'

/**
 * Chia Tiền kèm UTM để bên đó thống kê được lượt truy cập đến từ app này (nguồn = domain app, kênh =
 * referral, chiến dịch = mục ghi công, cuối bảng Lịch sử cập nhật).
 */
const CHIATIEN_URL =
  'https://chiatien.cangao.asia/?utm_source=charging.cangao.asia&utm_medium=referral&utm_campaign=tramsac_credits&utm_content=changelog'

/** Người làm app (tên tác giả commit trong repo). */
const DEVELOPER = 'NghiaDT'

interface Credit {
  name: string
  what: string
  href?: string
}

const L = pick({
  vi: {
    title: 'Thông tin & ghi công',
    dev: 'Phát triển',
    sources: 'Nguồn dữ liệu',
    others: 'Ứng dụng khác',
    version: (v: string) => `Phiên bản ${v}`,
    note: 'Ứng dụng độc lập, không phải sản phẩm chính thức của VinFast. Số liệu pin / thời gian sạc là ước tính.',
    sourceList: [
      { name: 'VinFast', what: 'Danh sách trạm sạc, chi tiết trạm', href: 'https://vinfastauto.com/vn_vi' },
      { name: 'EVCS.VN', what: 'Số cổng trống theo thời gian thực', href: 'https://evcs.vn' },
      { name: 'OpenStreetMap', what: 'Dữ liệu bản đồ © OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' },
      { name: 'OpenFreeMap · OpenMapTiles', what: 'Ô bản đồ nền', href: 'https://openfreemap.org' },
      { name: 'HERE Technologies', what: 'Tìm đường, tìm địa chỉ', href: 'https://www.here.com' },
      { name: 'ev-database.org · evkx.net', what: 'Đối chiếu đường cong sạc (ước tính)', href: 'https://ev-database.org' },
    ] as Credit[],
    otherList: [{ name: 'Chia Tiền', what: 'App chia tiền nhóm, đi du lịch — miễn phí', href: CHIATIEN_URL }] as Credit[],
  },
  en: {
    title: 'About & credits',
    dev: 'Developer',
    sources: 'Data sources',
    others: 'Other apps',
    version: (v: string) => `Version ${v}`,
    note: 'An independent app, not an official VinFast product. Battery and charging times are estimates.',
    sourceList: [
      { name: 'VinFast', what: 'Charging station list and details', href: 'https://vinfastauto.com/vn_vi' },
      { name: 'EVCS.VN', what: 'Real-time free ports', href: 'https://evcs.vn' },
      { name: 'OpenStreetMap', what: 'Map data © OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' },
      { name: 'OpenFreeMap · OpenMapTiles', what: 'Base map tiles', href: 'https://openfreemap.org' },
      { name: 'HERE Technologies', what: 'Routing and address search', href: 'https://www.here.com' },
      { name: 'ev-database.org · evkx.net', what: 'Charging curve reference (estimates)', href: 'https://ev-database.org' },
    ] as Credit[],
    otherList: [{ name: 'Chia Tiền', what: 'Group expense splitting for trips — free', href: CHIATIEN_URL }] as Credit[],
  },
})

/** Mục cuối của Cài đặt: người làm, nguồn dữ liệu (ghi công bắt buộc của OSM / OpenMapTiles), app khác. */
export function Credits() {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">{L.title}</h3>

      <Group title={L.dev}>
        <Row item={{ name: DEVELOPER, what: L.version(APP_VERSION) }} />
      </Group>
      <Collapsible title={L.sources} summary={L.sourceList.map((c) => c.name).join(', ')}>
        {L.sourceList.map((c) => (
          <Row key={c.name} item={c} />
        ))}
      </Collapsible>
      <Group title={L.others}>
        {L.otherList.map((c) => (
          <Row key={c.name} item={c} />
        ))}
      </Group>

      <p className="text-[11px] text-muted-foreground">{L.note}</p>
    </section>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{title}</span>
      <ul className="flex flex-col overflow-hidden rounded-xl bg-muted">{children}</ul>
    </div>
  )
}

/** Nhóm thu gọn mặc định: một hàng tóm tắt + mũi tên, bấm để mở danh sách. */
function Collapsible({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{title}</span>
      <div className="overflow-hidden rounded-xl bg-muted">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-brand/35"
        >
          <span className="min-w-0 flex-1 truncate text-sm">{summary}</span>
          <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {open && <ul className="flex flex-col border-t border-border/60">{children}</ul>}
      </div>
    </div>
  )
}

function Row({ item }: { item: Credit }) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{item.name}</span>
        <span className="text-xs text-muted-foreground">{item.what}</span>
      </span>
      {item.href && <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </>
  )
  return (
    <li className="border-b border-border/60 last:border-b-0">
      {item.href ? (
        <a href={item.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2.5 outline-none hover:bg-background/40 focus-visible:ring-3 focus-visible:ring-brand/35">
          {body}
        </a>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2.5">{body}</div>
      )}
    </li>
  )
}
