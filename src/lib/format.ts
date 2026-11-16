/** "850 m", "3.2 km". */
export function fmtDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

/** 120 → "120", 7.4 → "7.4". */
export function fmtKw(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}
