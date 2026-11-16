import {
  BedDouble,
  Bookmark,
  BriefcaseBusiness,
  Coffee,
  Flag,
  Heart,
  House,
  MapPin,
  ShoppingCart,
  Star,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { GroupIconKey, StationGroup } from '../data/groups'
import { pinDataUrl, darkenHex, PIN_ASPECT, type PinGlyph } from '../map/pins'

/** Mã hình (tầng dữ liệu) → icon. Mã lạ rơi về Bookmark: dữ liệu cũ không được làm sập app. */
const ICONS: Record<GroupIconKey, LucideIcon> = {
  heart: Heart,
  star: Star,
  flag: Flag,
  bookmark: Bookmark,
  bolt: Zap,
  place: MapPin,
  home: House,
  work: BriefcaseBusiness,
  cart: ShoppingCart,
  coffee: Coffee,
  bed: BedDouble,
}

export function groupIcon(key: string): LucideIcon {
  return ICONS[key as GroupIconKey] ?? Bookmark
}

/** Icon nhóm tô đặc theo màu nhóm — cùng ngôn ngữ với hình trong lòng ghim. */
export function GroupGlyph({
  group,
  className,
}: {
  group: Pick<StationGroup, 'iconKey' | 'colorHex'>
  className?: string
}) {
  const Icon = groupIcon(group.iconKey)
  const solid = ['heart', 'star', 'flag', 'bookmark', 'place'].includes(group.iconKey)
  return (
    <Icon
      aria-hidden
      className={className}
      color={darkenHex(group.colorHex, 0.85)}
      fill={solid ? darkenHex(group.colorHex, 0.85) : 'none'}
    />
  )
}

/** Ảnh ghim y hệt trên bản đồ — dùng làm hình minh hoạ trong bảng nhóm. */
export function PinPreview({
  group,
  width = 34,
  className,
}: {
  group: { iconKey: PinGlyph; colorHex: string }
  width?: number
  className?: string
}) {
  return (
    <img
      alt=""
      aria-hidden
      draggable={false}
      width={width}
      height={Math.round(width * PIN_ASPECT)}
      src={pinDataUrl({ colorHex: group.colorHex, glyph: group.iconKey }, width * 2)}
      className={className}
    />
  )
}
