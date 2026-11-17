import { useState } from 'react'
import { Segmented } from '@/components/ui/segmented'
import { Input } from '@/components/ui/input'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import type { Settings } from '../data/settings'
import { CUSTOM_ID, VEHICLES } from '../data/vehicles'
import { RESERVE_MAX, RESERVE_MIN, RESERVE_OPTIONS } from '../data/battery'
import { LOCALE, pick } from '@/i18n'
import { AppSheet } from './AppSheet'

const L = pick({
  vi: {
    title: 'Xe của bạn',
    hint: 'Để ước tính % pin khi tới trạm. Số liệu ước tính — thực tế tuỳ cách lái, tải và độ dốc.',
    model: 'Mẫu xe',
    noVehicle: 'Chưa chọn',
    custom: 'Tuỳ chỉnh…',
    capacity: 'Pin (kWh)',
    usage: 'Tiêu thụ (kWh/100 km)',
    real: 'Tiêu thụ thực tế (kWh/100 km)',
    realHint: (v: string) => `Đọc mức tiêu thụ trung bình trên màn hình xe. Để trống = ước tính ${v} kWh/100 km.`,
    climate: 'Điều hoà',
    reserve: 'Pin dự phòng tối thiểu',
    other: 'Khác',
    reserveInput: `Mức dự phòng (%, ${RESERVE_MIN}–${RESERVE_MAX})`,
    reserveHint: 'Kế hoạch sạc và vạch "Trạm cuối còn kịp" luôn chừa lại ít nhất mức này (theo ước tính bi quan).',
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
    real: 'Real consumption (kWh/100 km)',
    realHint: (v: string) => `Read the average consumption on your car's display. Leave empty to use the ${v} kWh/100 km estimate.`,
    climate: 'Air conditioning',
    reserve: 'Minimum battery reserve',
    other: 'Other',
    reserveInput: `Reserve (%, ${RESERVE_MIN}–${RESERVE_MAX})`,
    reserveHint: 'The charging plan and the "last station you can reach" line always keep at least this much (pessimistic estimate).',
    on: 'On',
    off: 'Off',
  },
})

export const fmtNum = (v: number) => v.toLocaleString(LOCALE, { maximumFractionDigits: 2 })

/** Radix Select không nhận giá trị rỗng — "chưa chọn" dùng mã riêng, đổi về null khi lưu. */
const NONE = 'none'

const MODEL_OPTIONS = [
  { value: NONE, label: L.noVehicle },
  ...VEHICLES.map((v) => ({
    value: v.id,
    label: (
      // Một span bọc ngoài: khung nhãn của ResponsiveSelect là flex có gap, tách rời các con.
      <span>
        {v.name} <span className="text-muted-foreground">· {fmtNum(v.kwh)} kWh</span>
      </span>
    ),
  })),
  { value: CUSTOM_ID, label: L.custom },
]

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
  const model = VEHICLES.find((v) => v.id === settings.vehicleId)
  return (
    <AppSheet
      nested={nested}
      open={open}
      onClose={onClose}
      autoFocus={false}
      title={L.title}
      description={L.hint}
    >
      <div className="mt-3 flex flex-col gap-4 pb-2 sm:mt-0">
        <section className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold">{L.model}</h3>
          <ResponsiveSelect
            title={L.model}
            value={settings.vehicleId ?? NONE}
            // Số tiêu thụ đọc trên xe cũ không còn đúng cho mẫu mới.
            onChange={(v) => onChange({ vehicleId: v === NONE ? null : v, usageOverride: null })}
            options={MODEL_OPTIONS}
          />
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
          {model && (
            <label className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
              {L.real}
              <Input
                // key theo mẫu: đổi mẫu thì ô trống lại (defaultValue chỉ đọc lúc gắn).
                key={model.id}
                type="number"
                inputMode="decimal"
                min={5}
                max={60}
                step="0.1"
                placeholder={fmtNum(model.kwhPer100)}
                defaultValue={settings.usageOverride ?? ''}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (!e.target.value) onChange({ usageOverride: null })
                  else if (Number.isFinite(v) && v >= 5 && v <= 60) onChange({ usageOverride: v })
                }}
                className="text-foreground"
              />
              <span>{L.realHint(fmtNum(model.kwhPer100))}</span>
            </label>
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

        {settings.vehicleId && (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">{L.reserve}</h3>
            <ReservePicker value={settings.reservePct} onChange={(reservePct) => onChange({ reservePct })} />
            <p className="text-xs text-muted-foreground">{L.reserveHint}</p>
          </section>
        )}
      </div>
    </AppSheet>
  )
}

const OTHER = 'other'

/** Mẫu 10/15/20/30% + "Khác" để tự nhập. Giá trị không trùng mẫu thì mở sẵn ô nhập. */
function ReservePicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const preset = (RESERVE_OPTIONS as readonly number[]).includes(value)
  const [custom, setCustom] = useState(!preset)
  return (
    <>
      <Segmented
        label={L.reserve}
        value={custom ? OTHER : String(value)}
        onChange={(v) => {
          if (v === OTHER) return setCustom(true)
          setCustom(false)
          onChange(Number(v))
        }}
        options={[...RESERVE_OPTIONS.map((p) => ({ value: String(p), label: `${p}%` })), { value: OTHER, label: L.other }]}
      />
      {custom && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {L.reserveInput}
          <Input
            type="number"
            inputMode="numeric"
            min={RESERVE_MIN}
            max={RESERVE_MAX}
            step="1"
            defaultValue={value}
            autoFocus={preset}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (e.target.value && Number.isInteger(v) && v >= RESERVE_MIN && v <= RESERVE_MAX) onChange(v)
            }}
            className="text-foreground"
          />
        </label>
      )}
    </>
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
