import { pick } from '../i18n'

/** "850 m", "3.2 km". */
export function fmtDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

/** 120 → "120", 7.4 → "7.4". */
export function fmtKw(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

const DUR = pick({
  vi: {
    min: (m: number) => `${m} phút`,
    hr: (h: number) => `${h} giờ`,
    hrMin: (h: number, m: number) => `${h} giờ ${m} phút`,
  },
  en: {
    min: (m: number) => `${m} min`,
    hr: (h: number) => `${h} h`,
    hrMin: (h: number, m: number) => `${h} h ${m} min`,
  },
})

/** Thời lượng từ giây: "18 phút", "1 giờ 5 phút", "2 giờ" (tối thiểu 1 phút). */
export function fmtMinutes(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60))
  if (m < 60) return DUR.min(m)
  const h = Math.floor(m / 60)
  return m % 60 ? DUR.hrMin(h, m % 60) : DUR.hr(h)
}
