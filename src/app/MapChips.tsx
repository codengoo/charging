import { List, LocateFixed, Route } from 'lucide-react'
import { Chip } from '@/components/ui/chip'
import { pick } from '../i18n'

const T = pick({
  vi: {
    nearMe: 'Gần tôi',
    alongRoute: 'Dọc đường',
    saved: (n: number) => `Đã lưu${n ? ` (${n})` : ''}`,
    list: 'Danh sách',
  },
  en: {
    nearMe: 'Near me',
    alongRoute: 'Along route',
    saved: (n: number) => `Saved${n ? ` (${n})` : ''}`,
    list: 'List',
  },
})

interface Props {
  onNearby: () => void
  tripOpen: boolean
  onToggleTrip: () => void
  savedCount: number
  savedOnly: boolean
  onToggleSaved: () => void
  kwLabel: string
  kwOn: boolean
  onToggleKw: () => void
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
      <FilterChip label={T.saved(p.savedCount)} on={p.savedOnly} onClick={p.onToggleSaved} />
      <FilterChip label={p.kwLabel} on={p.kwOn} onClick={p.onToggleKw} />
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
