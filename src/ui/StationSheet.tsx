import type { ReactNode } from 'react'
import { Heart, Navigation, QrCode } from 'lucide-react'
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
import type { Station } from '../data/types'
import { GroupGlyph } from './groupIcons'

interface Props {
  station: Station
  book: GroupBook
  onOpenGroups: () => void
  onShare: () => void
  onClose: () => void
  /** Bảng con (xếp nhóm, chia sẻ), render BÊN TRONG cây hộp thoại này để vaul xếp chồng đúng. */
  children?: ReactNode
}

export function StationSheet({ station, book, onOpenGroups, onShare, onClose, children }: Props) {
  const gmapsDir = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`
  const groups = groupsOf(book, station.entityId)
    .map((id) => group(book, id))
    .filter((g) => g !== undefined)
  const saved = groups.length > 0

  return (
    <ResponsiveDialog open onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="pr-6 text-lg">{station.name}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-sm">
            {station.address}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="mt-2 flex flex-wrap gap-2">
          <Chip size="sm" variant={station.isPublic ? 'default' : 'secondary'}>
            {station.isPublic ? 'Công cộng' : 'Nội bộ'}
          </Chip>
          {station.hasLink && <Chip size="sm">Trụ LINK</Chip>}
          {station.parkingFee && <Chip size="sm" variant="outline">Có thể mất phí gửi xe</Chip>}
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

        <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          Số cổng, công suất và trạng thái còn/hết chỗ sẽ bổ sung ở bản sau.
        </p>

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
