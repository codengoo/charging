import { BatteryMedium, List, LocateFixed, Route, SlidersHorizontal } from 'lucide-react'
import { Chip } from '@/components/ui/chip'
import { pick } from '../i18n'

const T = pick({
  vi: {
    nearMe: 'Gần tôi',
    alongRoute: 'Dọc đường',
    range: 'Tầm pin',
    saved: (n: number) => `Đã lưu${n ? ` (${n})` : ''}`,
    filters: (n: number) => `Bộ lọc (${n})`,
    list: 'Danh sách',
  },
  en: {
    nearMe: 'Near me',
    alongRoute: 'Along route',
    range: 'Range',
    saved: (n: number) => `Saved${n ? ` (${n})` : ''}`,
    filters: (n: number) => `Filters (${n})`,
    list: 'List',
  },
})

interface Props {
  onNearby: () => void
  tripOpen: boolean
  onToggleTrip: () => void
  rangeOn: boolean
  onToggleRange: () => void
  savedCount: number
  savedOnly: boolean
  onToggleSaved: () => void
  kwLabel: string
  kwOn: boolean
  onToggleKw: () => void
  /** Số bộ lọc thêm đang bật trong Cài đặt (công cộng, gửi xe, số cổng); 0 = ẩn chip. */
  extraFilters: number
  onFilters: () => void
  onList: () => void
}

/**
 * Hàng chip dưới ô tìm kiếm. Một hàng vuốt ngang: nhiều chip quá thì không xuống dòng che bản đồ.
 * py/-my chừa chỗ cho bóng chip khỏi bị overflow cắt.
 */
export function MapChips(p: Props) {
  return (
    <div className="pointer-events-auto -mx-3 -my-2 flex gap-2 overflow-x-auto px-3 py-2 no-scrollbar">
      <Chip variant="floating" onClick={p.onNearby}>
        <LocateFixed />
        {T.nearMe}
      </Chip>
      <Chip variant="floating" selected={p.tripOpen} onClick={p.onToggleTrip}>
        <Route />
        {T.alongRoute}
      </Chip>
      <Chip variant="floating" selected={p.rangeOn} className={p.rangeOn ? 'shadow-md shadow-black/10' : ''} onClick={p.onToggleRange}>
        <BatteryMedium />
        {T.range}
      </Chip>
      <FilterChip label={T.saved(p.savedCount)} on={p.savedOnly} onClick={p.onToggleSaved} />
      <FilterChip label={p.kwLabel} on={p.kwOn} onClick={p.onToggleKw} />
      {/* Lọc thêm đặt trong Cài đặt — chip chỉ để thấy là đang lọc, bấm mở Cài đặt sửa. */}
      {p.extraFilters > 0 && (
        <Chip variant="floating" selected className="shadow-md shadow-black/10" onClick={p.onFilters}>
          <SlidersHorizontal />
          {T.filters(p.extraFilters)}
        </Chip>
      )}
      <Chip variant="floating" onClick={p.onList}>
        <List />
        {T.list}
      </Chip>
    </div>
  )
}

function FilterChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <Chip variant="floating" selected={on} className={on ? 'shadow-md shadow-black/10' : ''} onClick={onClick}>
      {label}
    </Chip>
  )
}
