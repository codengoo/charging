import { useState, type ReactNode } from 'react'
import { SwitchRow } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { DEFAULT_SETTINGS, type Settings } from '../data/settings'
import { KW_BANDS, KW_BAND_LABEL } from '../data/stations'
import { TRIP_RADII, type TripRadius } from '../data/tripTypes'
import { CarFront, CheckIcon, ChevronRight, MapPin } from 'lucide-react'
import { cn } from 'cn'
import { LANG, pick, type Lang } from '@/i18n'
import { switchLang } from '@/lib/langSwitch'
import { THEME_PREFS, type ThemePref } from '@/lib/theme'
import { VehicleSheet, vehicleSummary } from './VehicleSheet'
import { AppSheet } from './AppSheet'

const L = pick({
  vi: {
    title: 'Cài đặt hiển thị',
    description: 'Áp dụng mỗi lần mở app. Chip lọc trên bản đồ vẫn bật/tắt tạm thời được.',
    language: 'Ngôn ngữ',
    theme: 'Giao diện',
    themeNames: { system: 'Theo máy', light: 'Sáng', dark: 'Tối' } as Record<ThemePref, string>,
    power: 'Công suất ưu tiên',
    powerHint: 'Theo cổng mạnh nhất của trạm. Bỏ chọn bớt mức thì trạm chưa có dữ liệu công suất bị ẩn.',
    activeOnly: 'Chỉ trạm đang hoạt động',
    activeHint: 'Ẩn trạm bảo trì, ngừng hoạt động, sắp khai trương.',
    corridor: 'Bề rộng hành lang dọc đường',
    legend: 'Chú giải màu ghim',
    reset: 'Khôi phục mặc định',
    vehicle: 'Xe của bạn',
    places: 'Địa điểm của tôi',
    noPlaces: 'Nhà, Công ty… — chạm để đặt',
    noVehicle: 'Chưa chọn',
    climateOn: 'điều hoà bật',
  },
  en: {
    title: 'Display settings',
    description: 'Applied every time you open the app. Map filter chips can still be toggled temporarily.',
    language: 'Language',
    theme: 'Appearance',
    themeNames: { system: 'System', light: 'Light', dark: 'Dark' } as Record<ThemePref, string>,
    power: 'Preferred power',
    powerHint: "By the station's fastest port. Unticking a level hides stations without power data.",
    activeOnly: 'Operating stations only',
    activeHint: 'Hide stations under maintenance, closed or opening soon.',
    corridor: 'Distance from route',
    legend: 'Pin colour legend',
    reset: 'Reset to defaults',
    vehicle: 'Your car',
    places: 'My places',
    noPlaces: 'Home, Work… — tap to set',
    noVehicle: 'Not set',
    climateOn: 'A/C on',
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
  /** "Nhà · Công ty · Quê" — null khi chưa đặt địa điểm nào. */
  placesSummary: string | null
  onOpenPlaces: () => void
  /** Bảng con mở chồng (vd. Địa điểm của tôi). */
  children?: ReactNode
}

/** Cấu hình hiển thị: đổi là lưu và áp dụng ngay, không có nút "Lưu". */
export function SettingsSheet({ open, settings, onChange, onClose, placesSummary, onOpenPlaces, children }: Props) {
  const [vehicleOpen, setVehicleOpen] = useState(false)
  const car = vehicleSummary(settings)
  return (
    <AppSheet
      open={open}
      onClose={onClose}
      autoFocus={false}
      title={L.title}
      description={L.description}
    >
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

        <Field title={L.vehicle}>
          <button
            type="button"
            onClick={() => setVehicleOpen(true)}
            className="flex h-12 w-full items-center gap-3 rounded-xl bg-muted px-3 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-brand/35"
          >
            <CarFront className="size-5 shrink-0 text-brand" aria-hidden />
            {car ? (
              <span className="min-w-0 flex-1 truncate">
                {car}
                {settings.climate && <span className="text-muted-foreground"> · {L.climateOn}</span>}
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{L.noVehicle}</span>
            )}
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </Field>

        <Field title={L.places}>
          <button
            type="button"
            onClick={onOpenPlaces}
            className="flex h-12 w-full items-center gap-3 rounded-xl bg-muted px-3 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-brand/35"
          >
            <MapPin className="size-5 shrink-0 text-brand" aria-hidden />
            <span className={`min-w-0 flex-1 truncate ${placesSummary ? '' : 'text-muted-foreground'}`}>{placesSummary ?? L.noPlaces}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
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

        <SwitchRow title={L.activeOnly} hint={L.activeHint} checked={settings.activeOnly} onCheckedChange={(activeOnly) => onChange({ activeOnly })} />

        <Field title={L.corridor}>
          <Segmented
            label={L.corridor}
            value={String(settings.tripRadiusKm)}
            onChange={(v) => onChange({ tripRadiusKm: Number(v) as TripRadius })}
            options={TRIP_RADII.map((r) => ({ value: String(r), label: `${r} km` }))}
          />
        </Field>

        <SwitchRow title={L.legend} checked={settings.showLegend} onCheckedChange={(showLegend) => onChange({ showLegend })} />

        <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => onChange(resetKeepingCar(settings))}>
          {L.reset}
        </Button>
      </div>
      <VehicleSheet nested open={vehicleOpen} settings={settings} onChange={onChange} onClose={() => setVehicleOpen(false)} />
      {children}
    </AppSheet>
  )
}

/** "Khôi phục mặc định" là cấu hình HIỂN THỊ — xe của người dùng không phải sở thích hiển thị, giữ lại. */
function resetKeepingCar(s: Settings): Settings {
  const { vehicleId, customKwh, customKwhPer100, usageOverride, climate } = s
  return { ...DEFAULT_SETTINGS, vehicleId, customKwh, customKwhPer100, usageOverride, climate }
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
