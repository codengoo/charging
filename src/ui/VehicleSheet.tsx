import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SwitchRow } from '@/components/ui/switch'
import { Segmented } from '@/components/ui/segmented'
import { Input } from '@/components/ui/input'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { MAX_CARS, allCars, type Settings } from '../data/settings'
import { CUSTOM_ID, DRIVE_STYLES, HEALTH_OPTIONS, VEHICLES, vehicleOf, type DriveStyle } from '../data/vehicles'
import { ChargeCurveChart } from './ChargeCurveChart'
import { RESERVE_MAX, RESERVE_MIN, RESERVE_OPTIONS } from '../data/battery'
import {
  DEFAULT_FUEL_PER100,
  DEFAULT_FUEL_PRICE,
  DEFAULT_PRICE,
  FUEL_PER100_MAX,
  FUEL_PER100_MIN,
  FUEL_PRICE_MAX,
  PRICE_MAX,
} from '../data/cost'
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
    slot: 'Xe đang dùng',
    slotName: (n: number) => `Xe ${n}`,
    slotHint: 'Mỗi xe nhớ riêng mẫu xe, tiêu thụ, pin còn lại và % pin. Điều hoà, dự phòng, giá và kiểu lái dùng chung.',
    addCar: 'Thêm xe',
    removeCar: 'Xoá xe này',
    confirmRemove: (name: string) => `Xoá ${name} khỏi danh sách xe?`,
    notSet: 'chưa chọn mẫu',
    style: 'Kiểu lái',
    styles: { eco: 'Tiết kiệm', normal: 'Bình thường', fast: 'Nhanh' } as Record<DriveStyle, string>,
    styleHint: 'Tiết kiệm −8%, nhanh +12% mức tiêu thụ ước tính.',
    styleOff: 'Đang dùng tiêu thụ thực tế bạn nhập — kiểu lái không áp dụng.',
    health: 'Pin còn lại',
    healthHint: 'Pin dùng lâu năm giảm dung lượng. Xe đã đi nhiều thì chọn mức ước chừng để ước tính sát hơn.',
    climateHint: 'Bật thì tiêu thụ tăng khoảng 8%.',
    reserve: 'Pin dự phòng tối thiểu',
    other: 'Khác',
    reserveInput: `Mức dự phòng (%, ${RESERVE_MIN}–${RESERVE_MAX})`,
    reserveHint: 'Kế hoạch sạc và vạch "Trạm cuối còn kịp" luôn chừa lại ít nhất mức này (theo ước tính bi quan).',
    price: 'Giá sạc (đ/kWh)',
    priceHint: (d: string) => `Để ước tính tiền sạc. Mặc định ${d} đ/kWh (giá trạm VinFast tham khảo). Nhập 0 nếu bạn được sạc miễn phí.`,
    fuel: "So với xe xăng",
    fuelUse: "Xe xăng (L/100 km)",
    fuelPrice: "Giá xăng (đ/L)",
    fuelHint: "Kế hoạch sạc dọc đường so chi phí cả chuyến với xe xăng cùng quãng. Giá xăng 0 = không so.",
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
    slot: 'Car in use',
    slotName: (n: number) => `Car ${n}`,
    slotHint: 'Each car keeps its own model, consumption, battery health and charge level. A/C, reserve, prices and driving style are shared.',
    addCar: 'Add a car',
    removeCar: 'Remove this car',
    confirmRemove: (name: string) => `Remove ${name} from your cars?`,
    notSet: 'no model set',
    style: 'Driving style',
    styles: { eco: 'Eco', normal: 'Normal', fast: 'Fast' } as Record<DriveStyle, string>,
    styleHint: 'Eco −8%, fast +12% on the estimated consumption.',
    styleOff: 'Using the real consumption you entered — driving style does not apply.',
    health: 'Battery health',
    healthHint: 'Batteries lose capacity over the years. If your car has a lot of miles, pick a rough level for closer estimates.',
    climateHint: 'Adds about 8% to consumption when on.',
    reserve: 'Minimum battery reserve',
    other: 'Other',
    reserveInput: `Reserve (%, ${RESERVE_MIN}–${RESERVE_MAX})`,
    reserveHint: 'The charging plan and the "last station you can reach" line always keep at least this much (pessimistic estimate).',
    price: 'Charging price (VND/kWh)',
    priceHint: (d: string) => `Used to estimate charging cost. Default ${d} VND/kWh (VinFast station list price, for reference). Enter 0 if you charge for free.`,
    fuel: "Compared with a petrol car",
    fuelUse: "Petrol car (L/100 km)",
    fuelPrice: "Petrol price (VND/L)",
    fuelHint: "The charging plan compares the whole trip cost with a petrol car over the same distance. Price 0 = no comparison.",
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
export function vehicleSummary(s: Pick<Settings, 'vehicleId' | 'customKwh'>): string | null {
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
  /** Chọn / thêm / xoá xe — App tráo cài đặt xe và % pin. */
  onCar: (a: CarAction) => void
}

export type CarAction = { type: 'select'; id: number } | { type: 'add' } | { type: 'remove'; id: number }

/** Mục "+ Thêm xe" trong danh sách chọn xe. */
const ADD = 'add'

/** Drawer riêng chọn xe + điều hoà; đổi là lưu ngay như Cài đặt. */
export function VehicleSheet({ open, settings, onChange, onClose, nested = false, onCar }: Props) {
  const model = VEHICLES.find((v) => v.id === settings.vehicleId)
  const car = vehicleOf(settings.vehicleId, settings.customKwh, settings.customKwhPer100, settings.usageOverride, {
    health: settings.batteryHealth,
    style: settings.driveStyle,
  })
  const cars = allCars(settings)
  const carName = (c: { id: number } & Pick<Settings, 'vehicleId' | 'customKwh'>) =>
    `${L.slotName(c.id)} · ${vehicleSummary(c) ?? L.notSet}`
  const carOptions = [
    ...cars.map((c) => ({ value: String(c.id), label: carName(c) })),
    ...(cars.length < MAX_CARS
      ? [{ value: ADD, label: <span className="flex items-center gap-1.5 text-brand"><Plus className="size-4" />{L.addCar}</span> }]
      : []),
  ]
  // Ô nhập dùng defaultValue: gắn key theo xe để đổi xe là đọc lại giá trị của xe mới — KHÔNG dựng lại
  // cả nội dung bảng (đổi chiều cao đột ngột làm drawer vaul trên Safari iOS lệch chỗ).
  const k = (name: string) => `${settings.carId}-${name}`
  return (
    <AppSheet
      nested={nested}
      open={open}
      onClose={onClose}
      autoFocus={false}
      // Nhiều ô nhập (tiêu thụ, giá…): không dùng hai mốc snap để bàn phím iOS không che ô đang nhập.
      snap={false}
      title={L.title}
      description={L.hint}
    >
      <div className="mt-3 flex flex-col gap-4 pb-2 sm:mt-0">
        <section className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold">{L.slot}</h3>
          <ResponsiveSelect
            title={L.slot}
            value={String(settings.carId)}
            onChange={(v) => (v === ADD ? onCar({ type: 'add' }) : onCar({ type: 'select', id: Number(v) }))}
            options={carOptions}
          />
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-muted-foreground">{L.slotHint}</p>
            {cars.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="-mt-1 shrink-0 text-destructive hover:text-destructive"
                onClick={() => {
                  if (window.confirm(L.confirmRemove(carName({ ...settings, id: settings.carId })))) onCar({ type: 'remove', id: settings.carId })
                }}
              >
                <Trash2 />
                {L.removeCar}
              </Button>
            )}
          </div>
        </section>

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
                key={k('kwh')}
                label={L.capacity}
                value={settings.customKwh}
                min={5}
                max={250}
                onCommit={(customKwh) => onChange({ customKwh })}
              />
              <NumberField
                key={k('per100')}
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
                key={k(model.id)}
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
            <h3 className="text-sm font-semibold">{L.style}</h3>
            <Segmented
              label={L.style}
              value={settings.driveStyle}
              onChange={(driveStyle) => onChange({ driveStyle })}
              options={DRIVE_STYLES.map((st) => ({ value: st, label: L.styles[st] }))}
            />
            <p className="text-xs text-muted-foreground">{settings.usageOverride ? L.styleOff : L.styleHint}</p>
          </section>
        )}

        {settings.vehicleId && (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">{L.health}</h3>
            <Segmented
              label={L.health}
              value={String(settings.batteryHealth)}
              onChange={(v) => onChange({ batteryHealth: Number(v) })}
              options={HEALTH_OPTIONS.map((h) => ({ value: String(h), label: `${h}%` }))}
            />
            <p className="text-xs text-muted-foreground">{L.healthHint}</p>
          </section>
        )}

        {car && <ChargeCurveChart vehicle={car} />}

        {settings.vehicleId && (
          <SwitchRow title={L.climate} hint={L.climateHint} checked={settings.climate} onCheckedChange={(climate) => onChange({ climate })} />
        )}

        {settings.vehicleId && (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">{L.reserve}</h3>
            <ReservePicker value={settings.reservePct} onChange={(reservePct) => onChange({ reservePct })} />
            <p className="text-xs text-muted-foreground">{L.reserveHint}</p>
          </section>
        )}

        {settings.vehicleId && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{L.price}</span>
            <MoneyInput value={settings.pricePerKwh} fallback={DEFAULT_PRICE} max={PRICE_MAX} onCommit={(pricePerKwh) => onChange({ pricePerKwh })} />
            <span className="text-xs text-muted-foreground">{L.priceHint(DEFAULT_PRICE.toLocaleString(LOCALE))}</span>
          </label>
        )}

        {settings.vehicleId && (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">{L.fuel}</h3>
            <div className="flex gap-2">
              <NumberField
                label={L.fuelUse}
                value={settings.fuelPer100}
                min={FUEL_PER100_MIN}
                max={FUEL_PER100_MAX}
                placeholder={fmtNum(DEFAULT_FUEL_PER100)}
                onCommit={(fuelPer100) => onChange({ fuelPer100 })}
              />
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                {L.fuelPrice}
                <MoneyInput value={settings.fuelPrice} fallback={DEFAULT_FUEL_PRICE} max={FUEL_PRICE_MAX} onCommit={(fuelPrice) => onChange({ fuelPrice })} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">{L.fuelHint}</p>
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

const fmtMoney = (n: number) => n.toLocaleString(LOCALE, { maximumFractionDigits: 0 })

/**
 * Ô tiền có dấu phân tách hàng nghìn ("3.858"). type="number" không hiện được dấu phân tách nên
 * dùng ô chữ + bàn phím số: mỗi lần gõ lấy lại các chữ số, định dạng lại và đặt con trỏ đúng sau
 * chữ số vừa gõ. Để trống = `fallback` (placeholder); quá `max` thì kẹp lại.
 */
function MoneyInput({
  value,
  fallback,
  max,
  onCommit,
}: {
  value: number
  /** Để trống ô = giá trị này (hiện làm placeholder). */
  fallback: number
  max: number
  onCommit: (v: number) => void
}) {
  const [text, setText] = useState(() => fmtMoney(value))
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={fmtMoney(fallback)}
      value={text}
      onChange={(e) => {
        const el = e.target
        const caret = el.selectionStart ?? el.value.length
        const digitsBefore = el.value.slice(0, caret).replace(/\D/g, '').length
        const digits = el.value.replace(/\D/g, '')
        if (!digits) {
          setText('')
          onCommit(fallback)
          return
        }
        const n = Math.min(Number(digits), max)
        const next = fmtMoney(n)
        setText(next)
        onCommit(n)
        // Định dạng lại làm con trỏ nhảy về cuối — đặt lại ngay sau chữ số thứ `digitsBefore`.
        requestAnimationFrame(() => {
          let pos = 0
          for (let seen = 0; pos < next.length && seen < digitsBefore; pos++) if (/\d/.test(next[pos])) seen++
          el.setSelectionRange(pos, pos)
        })
      }}
    />
  )
}

/** Ô số: gõ tự do, chỉ lưu khi giá trị hợp lệ trong khoảng. */
function NumberField({
  label,
  value,
  min,
  max,
  onCommit,
  placeholder,
}: {
  label: string
  value: number
  min: number
  max: number
  onCommit: (v: number) => void
  placeholder?: string
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
        placeholder={placeholder}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (e.target.value && Number.isFinite(v) && v >= min && v <= max) onCommit(v)
        }}
        className="text-foreground"
      />
    </label>
  )
}
