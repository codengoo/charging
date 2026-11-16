import type { ReactNode } from 'react'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { DEFAULT_SETTINGS, type Settings } from '../data/settings'
import { KW_BANDS, KW_BAND_LABEL } from '../data/stations'
import { TRIP_RADII, type TripRadius } from '../data/useTrip'
import { CheckIcon } from 'lucide-react'
import { cn } from 'cn'

interface Props {
  /** Giữ component gắn và chỉ đổi `open` — gỡ hẳn khi đóng thì mất hiệu ứng trôi xuống. */
  open: boolean
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
}

const onOff = (on: string, off: string) => [
  { value: 'on' as const, label: on },
  { value: 'off' as const, label: off },
]

/** Cấu hình hiển thị: đổi là lưu và áp dụng ngay, không có nút "Lưu". */
export function SettingsSheet({ open, settings, onChange, onClose }: Props) {
  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <ResponsiveDialogHeader className="gap-1 pr-6 text-left">
          <ResponsiveDialogTitle className="text-base font-bold sm:text-lg">Cài đặt hiển thị</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-xs sm:text-sm">
            Áp dụng mỗi lần mở app. Chip lọc trên bản đồ vẫn bật/tắt tạm thời được.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="mt-3 flex flex-col gap-4 sm:mt-0">
          <Field
            title="Công suất ưu tiên"
            hint="Theo cổng mạnh nhất của trạm. Bỏ chọn bớt mức thì trạm chưa có dữ liệu công suất bị ẩn."
          >
            <div role="group" aria-label="Công suất ưu tiên" className="flex flex-col overflow-hidden rounded-xl bg-muted">
              {KW_BANDS.map((b) => {
                const checked = settings.kwBands.includes(b)
                // Luôn giữ ít nhất một mức — bỏ hết thì không còn trạm nào.
                const locked = checked && settings.kwBands.length === 1
                return (
                  <button
                    key={b}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    disabled={locked}
                    onClick={() =>
                      onChange({ kwBands: KW_BANDS.filter((x) => (x === b ? !checked : settings.kwBands.includes(x))) })
                    }
                    className="flex h-11 items-center gap-3 px-3 text-left text-sm outline-none not-last:border-b not-last:border-background focus-visible:bg-background/60 disabled:cursor-not-allowed"
                  >
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                        checked ? 'border-brand bg-brand text-brand-foreground' : 'border-muted-foreground/40 bg-card',
                      )}
                    >
                      {checked && <CheckIcon className="size-3.5" strokeWidth={3} />}
                    </span>
                    {KW_BAND_LABEL[b]}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field title="Trạng thái trạm">
            <Segmented
              label="Trạng thái trạm"
              value={settings.activeOnly ? 'on' : 'off'}
              onChange={(v) => onChange({ activeOnly: v === 'on' })}
              options={onOff('Đang hoạt động', 'Tất cả')}
            />
          </Field>

          <Field title="Bề rộng hành lang dọc đường">
            <Segmented
              label="Bề rộng hành lang dọc đường"
              value={String(settings.tripRadiusKm)}
              onChange={(v) => onChange({ tripRadiusKm: Number(v) as TripRadius })}
              options={TRIP_RADII.map((r) => ({ value: String(r), label: `${r} km` }))}
            />
          </Field>

          <Field title="Chú giải màu ghim">
            <Segmented
              label="Chú giải màu ghim"
              value={settings.showLegend ? 'on' : 'off'}
              onChange={(v) => onChange({ showLegend: v === 'on' })}
              options={onOff('Hiện', 'Ẩn')}
            />
          </Field>

          <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => onChange(DEFAULT_SETTINGS)}>
            Khôi phục mặc định
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

function Field({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </section>
  )
}
