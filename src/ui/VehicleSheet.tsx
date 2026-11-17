import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Segmented } from '@/components/ui/segmented'
import { Input } from '@/components/ui/input'
import type { Settings } from '../data/settings'
import { CUSTOM_ID, VEHICLES } from '../data/vehicles'
import { LOCALE, pick } from '@/i18n'

const L = pick({
  vi: {
    title: 'Xe của bạn',
    hint: 'Để ước tính % pin khi tới trạm. Số liệu ước tính — thực tế tuỳ cách lái, tải và độ dốc.',
    model: 'Mẫu xe',
    noVehicle: 'Chưa chọn',
    custom: 'Tuỳ chỉnh…',
    capacity: 'Pin (kWh)',
    usage: 'Tiêu thụ (kWh/100 km)',
    climate: 'Điều hoà',
    on: 'Bật',
    off: 'Tắt',
  },
  en: {
    title: 'Your car',
    hint: 'Used to estimate battery on arrival. Estimates only — real use depends on driving, load and terrain.',
    model: 'Model',
    noVehicle: 'Not set',
    custom: 'Custom…',
    capacity: 'Battery (kWh)',
    usage: 'Consumption (kWh/100 km)',
    climate: 'Air conditioning',
    on: 'On',
    off: 'Off',
  },
})

export const fmtNum = (v: number) => v.toLocaleString(LOCALE, { maximumFractionDigits: 2 })

/** "VF 6 · 59,6 kWh" / "Tuỳ chỉnh · 60 kWh" / null khi chưa chọn — dòng tóm tắt trong Cài đặt. */
export function vehicleSummary(s: Settings): string | null {
  if (!s.vehicleId) return null
  if (s.vehicleId === CUSTOM_ID) return `${L.custom.replace('…', '')} · ${fmtNum(s.customKwh)} kWh`
  const v = VEHICLES.find((x) => x.id === s.vehicleId)
  return v ? `${v.name} · ${fmtNum(v.kwh)} kWh` : null
}

interface Props {
  open: boolean
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
  /** Mở chồng lên một drawer khác (Cài đặt) — drawer dưới lùi lại phía sau. */
  nested?: boolean
}

/** Drawer riêng chọn xe + điều hoà; đổi là lưu ngay như Cài đặt. */
export function VehicleSheet({ open, settings, onChange, onClose, nested = false }: Props) {
  return (
    <ResponsiveDialog nested={nested} open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <ResponsiveDialogHeader className="gap-1 pr-6 text-left">
          <ResponsiveDialogTitle className="text-base font-bold sm:text-lg">{L.title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-xs sm:text-sm">{L.hint}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="mt-3 flex flex-col gap-4 pb-2 sm:mt-0">
          <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">{L.model}</h3>
            <select
              value={settings.vehicleId ?? ''}
              onChange={(e) => onChange({ vehicleId: e.target.value || null })}
              aria-label={L.model}
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
          </section>

          {settings.vehicleId && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold">{L.climate}</h3>
              <Segmented
                label={L.climate}
                value={settings.climate ? 'on' : 'off'}
                onChange={(v) => onChange({ climate: v === 'on' })}
                options={[
                  { value: 'on' as const, label: L.on },
                  { value: 'off' as const, label: L.off },
                ]}
              />
            </section>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

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
