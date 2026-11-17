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
import { Input } from '@/components/ui/input'
import { DEFAULT_SETTINGS, type Settings } from '../data/settings'
import { KW_BANDS, KW_BAND_LABEL } from '../data/stations'
import { TRIP_RADII, type TripRadius } from '../data/useTrip'
import { CheckIcon } from 'lucide-react'
import { cn } from 'cn'
import { LANG, LOCALE, pick, type Lang } from '@/i18n'
import { switchLang } from '@/lib/langSwitch'
import { THEME_PREFS, type ThemePref } from '@/lib/theme'
import { CUSTOM_ID, VEHICLES } from '../data/vehicles'

const L = pick({
  vi: {
    title: 'Cài đặt hiển thị',
    description: 'Áp dụng mỗi lần mở app. Chip lọc trên bản đồ vẫn bật/tắt tạm thời được.',
    language: 'Ngôn ngữ',
    theme: 'Giao diện',
    themeNames: { system: 'Theo máy', light: 'Sáng', dark: 'Tối' } as Record<ThemePref, string>,
    power: 'Công suất ưu tiên',
    powerHint: 'Theo cổng mạnh nhất của trạm. Bỏ chọn bớt mức thì trạm chưa có dữ liệu công suất bị ẩn.',
    status: 'Trạng thái trạm',
    active: 'Đang hoạt động',
    all: 'Tất cả',
    corridor: 'Bề rộng hành lang dọc đường',
    legend: 'Chú giải màu ghim',
    show: 'Hiện',
    hide: 'Ẩn',
    reset: 'Khôi phục mặc định',
    vehicle: 'Xe của bạn',
    vehicleHint: 'Để ước tính % pin khi tới trạm. Số liệu ước tính — thực tế tuỳ cách lái, tải và độ dốc.',
    noVehicle: 'Chưa chọn',
    custom: 'Tuỳ chỉnh…',
    capacity: 'Pin (kWh)',
    usage: 'Tiêu thụ (kWh/100 km)',
    climate: 'Điều hoà',
    on: 'Bật',
    off: 'Tắt',
  },
  en: {
    title: 'Display settings',
    description: 'Applied every time you open the app. Map filter chips can still be toggled temporarily.',
    language: 'Language',
    theme: 'Appearance',
    themeNames: { system: 'System', light: 'Light', dark: 'Dark' } as Record<ThemePref, string>,
    power: 'Preferred power',
    powerHint: "By the station's fastest port. Unticking a level hides stations without power data.",
    status: 'Station status',
    active: 'Operating',
    all: 'All',
    corridor: 'Distance from route',
    legend: 'Pin colour legend',
    show: 'Show',
    hide: 'Hide',
    reset: 'Reset to defaults',
    vehicle: 'Your car',
    vehicleHint: 'Used to estimate battery on arrival. Estimates only — real use depends on driving, load and terrain.',
    noVehicle: 'Not set',
    custom: 'Custom…',
    capacity: 'Battery (kWh)',
    usage: 'Consumption (kWh/100 km)',
    climate: 'Air conditioning',
    on: 'On',
    off: 'Off',
  },
})

/** Tên ngôn ngữ viết bằng chính ngôn ngữ đó — người không đọc được bản kia vẫn tìm ra. */
const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
]

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
          <ResponsiveDialogTitle className="text-base font-bold sm:text-lg">{L.title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-xs sm:text-sm">{L.description}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="mt-3 flex flex-col gap-4 sm:mt-0">
          {/* Đổi ngôn ngữ = chuyển sang URL kia (/ ↔ /en/) và tải lại. */}
          <Field title={L.language}>
            <Segmented label={L.language} value={LANG} onChange={switchLang} options={LANG_OPTIONS} />
          </Field>

          <Field title={L.theme}>
            <Segmented
              label={L.theme}
              value={settings.theme}
              onChange={(v) => onChange({ theme: v })}
              options={THEME_PREFS.map((t) => ({ value: t, label: L.themeNames[t] }))}
            />
          </Field>

          <Field title={L.vehicle} hint={L.vehicleHint}>
            <select
              value={settings.vehicleId ?? ''}
              onChange={(e) => onChange({ vehicleId: e.target.value || null })}
              aria-label={L.vehicle}
              className="h-10 w-full rounded-xl bg-muted px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-brand/35"
            >
              <option value="">{L.noVehicle}</option>
              {VEHICLES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {fmtNum(v.kwh)} kWh
                </option>
              ))}
              <option value={CUSTOM_ID}>{L.custom}</option>
            </select>
            {settings.vehicleId === CUSTOM_ID && (
              <div className="flex gap-2">
                <NumberField
                  label={L.capacity}
                  value={settings.customKwh}
                  min={5}
                  max={250}
                  onCommit={(customKwh) => onChange({ customKwh })}
                />
                <NumberField
                  label={L.usage}
                  value={settings.customKwhPer100}
                  min={5}
                  max={60}
                  onCommit={(customKwhPer100) => onChange({ customKwhPer100 })}
                />
              </div>
            )}
            {settings.vehicleId && (
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-sm">{L.climate}</span>
                <Segmented
                  label={L.climate}
                  value={settings.climate ? 'on' : 'off'}
                  onChange={(v) => onChange({ climate: v === 'on' })}
                  options={onOff(L.on, L.off)}
                />
              </div>
            )}
          </Field>

          <Field title={L.power} hint={L.powerHint}>
            <div role="group" aria-label={L.power} className="flex flex-col overflow-hidden rounded-xl bg-muted">
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

          <Field title={L.status}>
            <Segmented
              label={L.status}
              value={settings.activeOnly ? 'on' : 'off'}
              onChange={(v) => onChange({ activeOnly: v === 'on' })}
              options={onOff(L.active, L.all)}
            />
          </Field>

          <Field title={L.corridor}>
            <Segmented
              label={L.corridor}
              value={String(settings.tripRadiusKm)}
              onChange={(v) => onChange({ tripRadiusKm: Number(v) as TripRadius })}
              options={TRIP_RADII.map((r) => ({ value: String(r), label: `${r} km` }))}
            />
          </Field>

          <Field title={L.legend}>
            <Segmented
              label={L.legend}
              value={settings.showLegend ? 'on' : 'off'}
              onChange={(v) => onChange({ showLegend: v === 'on' })}
              options={onOff(L.show, L.hide)}
            />
          </Field>

          <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => onChange(resetKeepingCar(settings))}>
            {L.reset}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

/** "Khôi phục mặc định" là cấu hình HIỂN THỊ — xe của người dùng không phải sở thích hiển thị, giữ lại. */
function resetKeepingCar(s: Settings): Settings {
  const { vehicleId, customKwh, customKwhPer100, climate } = s
  return { ...DEFAULT_SETTINGS, vehicleId, customKwh, customKwhPer100, climate }
}

const fmtNum = (v: number) => v.toLocaleString(LOCALE, { maximumFractionDigits: 2 })

/** Ô số: gõ tự do, chỉ lưu khi giá trị hợp lệ trong khoảng. */
function NumberField({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  onCommit: (v: number) => void
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step="0.1"
        defaultValue={value}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (e.target.value && Number.isFinite(v) && v >= min && v <= max) onCommit(v)
        }}
        className="text-foreground"
      />
    </label>
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
