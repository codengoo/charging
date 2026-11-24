import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Moon, Sun, Umbrella, type LucideIcon } from 'lucide-react'
import { describe, rainSoon, type WeatherHour, type WeatherIcon, type WeatherState } from '../data/weather'
import { pick } from '../i18n'

const ICONS: Record<WeatherIcon, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  partly: CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  storm: CloudLightning,
}

const L = pick({
  vi: {
    title: 'Thời tiết tại trạm',
    feels: (t: number) => `cảm giác ${t}°`,
    wind: (k: number) => `gió ${k} km/h`,
    hour: (h: number) => `${h}h`,
    rainSoon: (h: number, p: number) => `Có thể mưa lúc ${h}h (${p}%) — mang ô nếu phải chờ ngoài trời.`,
    loading: 'Đang tải thời tiết…',
    error: 'Không lấy được thời tiết.',
  },
  en: {
    title: 'Weather at the station',
    feels: (t: number) => `feels ${t}°`,
    wind: (k: number) => `wind ${k} km/h`,
    hour: (h: number) => `${h}:00`,
    rainSoon: (h: number, p: number) => `Rain likely around ${h}:00 (${p}%) — bring an umbrella if you wait outside.`,
    loading: 'Loading weather…',
    error: "Couldn't load the weather.",
  },
})

/** Hộp thời tiết trong bảng trạm: hiện tại + 6 giờ tới (xác suất mưa), nhắc mang ô khi sắp mưa. */
export function WeatherBox({ state }: { state: WeatherState | null }) {
  if (!state) return null
  if (state.kind !== 'ok') {
    return (
      <p className="mt-2 rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
        {state.kind === 'loading' ? L.loading : L.error}
      </p>
    )
  }
  const { now, hours } = state.weather
  const d = describe(now.code, now.isDay)
  const Icon = ICONS[d.icon]
  const soon = rainSoon(state.weather)
  return (
    <section className="mt-2 flex flex-col gap-2 rounded-xl bg-muted px-3 py-2.5" aria-label={L.title}>
      <div className="flex items-center gap-2.5">
        <Icon className="size-7 shrink-0 text-brand" aria-hidden />
        <div className="flex min-w-0 flex-col">
          <span className="text-sm">
            <span className="text-base font-semibold tabular-nums">{Math.round(now.temp)}°C</span> · {d.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {L.feels(Math.round(now.feels))} · {L.wind(Math.round(now.windKmh))}
          </span>
        </div>
      </div>
      {hours.length > 0 && (
        <ol className="grid grid-cols-6 gap-1 text-center text-[11px]">
          {hours.map((h) => {
            const HIcon = ICONS[describe(h.code, h.hour >= 6 && h.hour < 18).icon]
            return (
              <li key={h.hour} className="flex flex-col items-center gap-0.5">
                <span className="text-muted-foreground">{L.hour(h.hour)}</span>
                <HIcon className="size-4" aria-hidden />
                <span className="font-semibold tabular-nums">{Math.round(h.temp)}°</span>
                <span className={`tabular-nums ${(h.rainPct ?? 0) >= 50 ? 'text-brand' : 'text-muted-foreground'}`}>
                  {h.rainPct === null ? '–' : `${h.rainPct}%`}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {soon && (
        <p className="flex items-start gap-1.5 text-xs">
          <Umbrella className="mt-px size-3.5 shrink-0 text-brand" aria-hidden />
          {L.rainSoon(soon.hour, soon.rainPct ?? 0)}
        </p>
      )}
    </section>
  )
}

/** Chip thời tiết nhỏ cho một giờ (điểm dừng trong kế hoạch sạc): biểu tượng, nhiệt độ, % mưa khi ≥ 30%. */
export function WeatherChip({ h }: { h: WeatherHour }) {
  const d = describe(h.code, h.hour >= 6 && h.hour < 18)
  const Icon = ICONS[d.icon]
  const rainy = (h.rainPct ?? 0) >= 30
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-muted-foreground" title={d.label}>
      <Icon className="size-3.5" aria-label={d.label} />
      <span className="tabular-nums">{Math.round(h.temp)}°</span>
      {rainy && <span className={`tabular-nums ${(h.rainPct ?? 0) >= 50 ? 'text-brand' : ''}`}>· {h.rainPct}%</span>}
    </span>
  )
}
