import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CHANGELOG, type ChangelogEntry } from '../data/changelog'
import { LANG, pick } from '../i18n'
import { AppSheet } from './AppSheet'
import { Credits } from './Credits'

const L = pick({
  vi: {
    title: 'Lịch sử cập nhật',
    more: (n: number) => `Xem thêm ${n} phiên bản cũ hơn`,
  },
  en: {
    title: 'Changelog',
    more: (n: number) => `Show ${n} older ${n === 1 ? 'version' : 'versions'}`,
  },
})

/** Số phiên bản mới nhất hiện sẵn; phần còn lại gom sau nút "Xem thêm". */
const RECENT = 3

// Trang /en: mục có bản tiếng Anh thì hiện tiếng Anh, chưa có thì giữ tiếng Việt.
const ENTRIES =
  LANG === 'en'
    ? CHANGELOG.map((e) => (e.changesEn ? { ...e, title: e.titleEn ?? e.title, changes: e.changesEn } : e))
    : CHANGELOG

interface Props {
  /** Giữ component gắn và chỉ đổi `open` — gỡ hẳn khi đóng thì mất hiệu ứng trôi xuống. */
  open: boolean
  onClose: () => void
}

export function ChangelogModal({ open, onClose }: Props) {
  const [showAll, setShowAll] = useState(false)
  // Mở lại lần sau thì thu gọn như mặc định.
  useEffect(() => {
    if (!open) setShowAll(false)
  }, [open])
  const older = ENTRIES.length - RECENT
  const shown = showAll ? ENTRIES : ENTRIES.slice(0, RECENT)

  return (
    <AppSheet
      open={open}
      onClose={onClose}
      title={L.title}
    >
      <div className="mt-2 flex flex-col gap-6">
        {shown.map((e) => (
          <Entry key={e.version} entry={e} />
        ))}
        {!showAll && older > 0 && (
          <Button variant="secondary" size="sm" className="-mt-2 self-start rounded-full" onClick={() => setShowAll(true)}>
            {L.more(older)}
            <ChevronDown />
          </Button>
        )}
        <Credits />
      </div>
    </AppSheet>
  )
}

function Entry({ entry: e }: { entry: ChangelogEntry }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2">
        <Badge className="border-transparent bg-brand text-brand-foreground">
          v{e.version}
        </Badge>
        <span className="text-xs text-muted-foreground">{e.date}</span>
      </div>
      {e.title && <p className="mb-2 text-sm font-semibold text-foreground">{e.title}</p>}
      <ul className="flex list-disc flex-col gap-1.5 pl-5">
        {e.changes.map((c, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-foreground">
            {c}
          </li>
        ))}
      </ul>
    </section>
  )
}
