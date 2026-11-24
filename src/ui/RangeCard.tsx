import { X, Zap } from 'lucide-react'
import type { BatteryReading } from '../data/battery'
import type { BatteryRange } from '../data/range'
import type { Vehicle } from '../data/vehicles'
import type { RangeLayer } from '../map/MapView'
import { pick } from '../i18n'
import { BatteryControl } from './BatteryControl'

const L = pick({
  vi: {
    title: 'Tầm đi với pin hiện tại',
    close: 'Tắt tầm pin',
    oneWay: 'Đi tới được',
    roundTrip: 'Đi rồi về',
    km: (km: number) => `~${km} km đường`,
    ringLabel: (km: number) => `~${km} km`,
    roundLabel: (km: number) => `đi về ~${km} km`,
    fast: (n: number) => (n ? `${n.toLocaleString('vi-VN')} trạm sạc nhanh DC trong tầm` : 'Không có trạm sạc nhanh DC nào trong tầm'),
    note: (car: string, r: number, gps: boolean) =>
      `${car}, ước tính bi quan, chừa ${r}% dự phòng. Vòng tròn là đường chim bay quanh ${gps ? 'vị trí của bạn' : 'tâm bản đồ'} — đường thật vòng hơn.`,
  },
  en: {
    title: 'Range with current battery',
    close: 'Hide range',
    oneWay: 'One way',
    roundTrip: 'There and back',
    km: (km: number) => `~${km} km by road`,
    ringLabel: (km: number) => `~${km} km`,
    roundLabel: (km: number) => `round trip ~${km} km`,
    fast: (n: number) => (n ? `${n.toLocaleString('en-US')} DC fast ${n === 1 ? 'charger' : 'chargers'} in range` : 'No DC fast chargers in range'),
    note: (car: string, r: number, gps: boolean) =>
      `${car}, pessimistic estimate keeping a ${r}% reserve. Circles are straight-line around ${gps ? 'your location' : 'the map centre'} — real roads wind more.`,
  },
})

/** Làm tròn km cho dễ đọc: dưới 100 tới 5 km, trên 100 tới 10 km. */
const roundKm = (km: number) => (km < 100 ? Math.round(km / 5) * 5 : Math.round(km / 10) * 10)

/** Hai vòng trên bản đồ: liền = đi tới được, đứt = đi rồi về. Nhãn ghi quãng ĐƯỜNG LÁI. */
export function rangeLayerOf(center: { lat: number; lng: number }, r: BatteryRange): RangeLayer {
  return {
    center,
    rings: [
      { km: r.oneWayKm, label: L.ringLabel(roundKm(r.roadKm)), kind: 'one-way' },
      { km: r.roundTripKm, label: L.roundLabel(roundKm(r.roadKm / 2)), kind: 'round-trip' },
    ],
  }
}

/** Thẻ nổi dưới hàng chip khi bật tầm pin: kéo % pin là vòng trên bản đồ vẽ lại. */
export function RangeCard({
  range,
  vehicle,
  reservePct,
  fromGps,
  fastInRange,
  reading,
  stale,
  onBattery,
  onClose,
}: {
  range: BatteryRange
  vehicle: Vehicle
  reservePct: number
  fromGps: boolean
  /** Trạm DC (theo bộ lọc) trong vòng "đi tới được"; null = chưa tính được. */
  fastInRange: number | null
  reading: BatteryReading | null
  stale: boolean
  onBattery: (pct: number) => void
  onClose: () => void
}) {
  return (
    <section
      aria-label={L.title}
      className="pointer-events-auto flex w-full max-w-sm flex-col gap-1.5 rounded-2xl bg-card/95 px-3 py-2.5 shadow-lg shadow-black/10 backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{L.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={L.close}
          className="-mr-1 flex size-7 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <X className="size-4" />
        </button>
      </div>
      <BatteryControl reading={reading} stale={stale} onChange={onBattery} />
      <div className="flex flex-col gap-0.5 pl-6 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-0 w-4 shrink-0 border-t-2 border-brand" aria-hidden />
          {L.oneWay}
          <span className="ml-auto font-semibold tabular-nums">{L.km(roundKm(range.roadKm))}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0 w-4 shrink-0 border-t-2 border-dashed border-brand" aria-hidden />
          {L.roundTrip}
          <span className="ml-auto font-semibold tabular-nums">{L.km(roundKm(range.roadKm / 2))}</span>
        </span>
      </div>
      {fastInRange !== null && (
        <p className={`flex items-center gap-1 pl-6 text-sm ${fastInRange ? 'text-foreground' : 'text-warn'}`}>
          <Zap className="-ml-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
          {L.fast(fastInRange)}
        </p>
      )}
      <p className="pl-6 text-[11px] text-muted-foreground">{L.note(vehicle.name, reservePct, fromGps)}</p>
    </section>
  )
}
