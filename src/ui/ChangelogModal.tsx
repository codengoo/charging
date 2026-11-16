import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Badge } from '@/components/ui/badge'
import { CHANGELOG } from '../data/changelog'
import { LANG, pick } from '../i18n'

const L = pick({
  vi: { title: 'Lịch sử cập nhật' },
  en: { title: 'Changelog' },
})

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
  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-lg">{L.title}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="mt-2 flex flex-col gap-6">
          {ENTRIES.map((e) => (
            <section key={e.version}>
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
          ))}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
