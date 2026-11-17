/**
 * Số cổng trống theo thời gian thực + lịch sử 24h từ EVCS.VN (qua Worker, xem worker/evcs.ts).
 * Port EvcsApi / EvcsHistory / EvcsStats của app Android, theo định dạng EVCS trả về hiện nay:
 * `/charging` không còn `busyKw` mà trả sẵn `ports` (HTML "✧ 60kW trống 7/10 cổng" — đã trừ
 * cổng hỏng / đặt trước, đúng con số app VinFast hiện), `chargingKw`, `maintPorts`.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { pick } from '../i18n'

export interface LivePorts {
  kw: number
  free: number
  total: number
}

export interface EvcsForecast {
  cars: number
  kw: number
  minMinutes: number
  maxMinutes: number
}

export interface LiveStatus {
  /** Theo mức kW, mạnh nhất trước. Rỗng = trạm không báo số cổng. */
  ports: LivePorts[]
  /** Số xe đang sạc (cả trạm). */
  charging: number
  /** Số cổng đang bảo trì / hỏng. */
  maintPorts: number
  maintenance: boolean
  /** "N xe trụ X kW sẽ xong trong a–b phút" — khách vãng lai thường bị khoá (cần EVCS Go). */
  forecast: EvcsForecast[]
  at: number
}

export interface HistoryPoint {
  at: number
  cars: number
}

export interface LiveHistory {
  all: HistoryPoint[]
  byKw: Map<number, HistoryPoint[]>
}

/** Lỗi lần hỏi — khác hẳn "trạm không có số liệu" (thử lại có thể được). */
export class LiveError extends Error {}

const PILL = /([\d.]+)\s*kW\s*trống\s*(\d+)\s*\/\s*(\d+)/gi
/**
 *   Dự kiến <b>15</b> xe sạc trụ <b>120kW</b> sẽ xong trong <b>1-27</b> phút nữa
 * Bắt theo thẻ <b> chứ không theo chữ: chữ có thể đổi, thứ tự ba số thì khó mà đổi.
 */
const TICKER = /<b>\s*(\d+)\s*<\/b>[^<]*<b>\s*([\d.]+)\s*kW\s*<\/b>[^<]*<b>\s*(\d+)(?:\s*-\s*(\d+))?\s*<\/b>\s*ph[uú]t/gi

interface ChargingBody {
  ports?: string
  ticker?: string
  charging?: number
  maintPorts?: number
  depotMaint?: boolean
}

export function parseLive(j: ChargingBody, at = Date.now()): LiveStatus {
  const byKw = new Map<number, LivePorts>()
  for (const m of (j.ports ?? '').matchAll(PILL)) {
    const kw = parseFloat(m[1])
    if (kw > 0 && !byKw.has(kw)) byKw.set(kw, { kw, free: +m[2], total: +m[3] })
  }
  const forecast: EvcsForecast[] = []
  for (const m of (j.ticker ?? '').matchAll(TICKER)) {
    const lo = +m[3]
    forecast.push({ cars: +m[1], kw: parseFloat(m[2]), minMinutes: lo, maxMinutes: m[4] ? +m[4] : lo })
  }
  return {
    ports: [...byKw.values()].sort((a, b) => b.kw - a.kw),
    charging: j.charging ?? 0,
    maintPorts: j.maintPorts ?? 0,
    maintenance: !!j.depotMaint,
    forecast,
    at,
  }
}

const MSG = pick({
  vi: { network: 'Không có mạng', tooFast: 'Gọi quá nhanh', timeout: 'Quá hạn chờ', busy: 'Nguồn dữ liệu đang bận', failed: 'Không lấy được số liệu' },
  en: { network: 'No connection', tooFast: 'Too many requests', timeout: 'Timed out', busy: 'Data source busy', failed: "Couldn't get data" },
})

/** Mã lỗi "trạm không có số liệu" (404) — UI so khớp mã này, không so chữ. */
export const UNAVAILABLE = 'unavailable'

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { signal })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new LiveError(MSG.network)
  }
  if (res.status === 429) throw new LiveError(MSG.tooFast)
  if (res.status === 404) throw new LiveError(UNAVAILABLE)
  if (!res.ok) throw new LiveError(res.status === 504 ? MSG.timeout : MSG.busy)
  return (await res.json()) as T
}

export async function fetchLive(storeId: string, signal?: AbortSignal): Promise<LiveStatus> {
  return parseLive(await getJson<ChargingBody>(`/api/live/${encodeURIComponent(storeId)}`, signal))
}

/** Server trả khi thì `[[t,v],…]`, khi thì `[{timestamp,value},…]`. */
function points(raw: unknown): HistoryPoint[] {
  if (!Array.isArray(raw)) return []
  const out: HistoryPoint[] = []
  for (const e of raw) {
    if (Array.isArray(e)) out.push({ at: Number(e[0]), cars: Number(e[1]) || 0 })
    else if (e && typeof e === 'object') {
      const o = e as { timestamp?: number; value?: number }
      out.push({ at: Number(o.timestamp), cars: Number(o.value) || 0 })
    }
  }
  return out.filter((p) => p.at > 0).sort((a, b) => a.at - b.at)
}

export async function fetchHistory(storeId: string, signal?: AbortSignal): Promise<LiveHistory> {
  const j = await getJson<{ all?: unknown; kw?: { series?: Array<{ kw?: number; points?: unknown }> } | null }>(
    `/api/live-history/${encodeURIComponent(storeId)}`,
    signal,
  )
  const byKw = new Map<number, HistoryPoint[]>()
  for (const s of j.kw?.series ?? []) {
    const pts = points(s.points)
    if (typeof s.kw === 'number' && pts.length) byKw.set(s.kw, pts)
  }
  return { all: points(j.all), byKw }
}

/**
 * Điểm lịch sử cuối cũ hơn mức này thì không dùng để ước tính "lúc này". EVCS chỉ ghi điểm
 * khi số xe ĐỔI — trạm đứng yên (thường về đêm) có điểm cuối cũ cả tiếng mà vẫn đúng.
 */
const ESTIMATE_MAX_AGE_MS = 3 * 60 * 60_000

/**
 * Dự phòng khi `/charging` không lấy được (EVCS chặn request từ Cloudflare Worker bằng trang
 * "Just a moment"): lấy số xe đang sạc ở điểm CUỐI của chuỗi lịch sử theo từng mức kW, trừ vào
 * số cổng của VinFast. Không trừ được cổng hỏng / đặt trước nên chỉ là ước tính — UI ghi rõ.
 * null khi không đủ dữ liệu (không có chuỗi theo kW, hoặc điểm cuối quá cũ).
 */
export function estimateFromHistory(
  history: LiveHistory | null,
  groups: Array<{ kw: number; count: number }>,
  now = Date.now(),
): { ports: LivePorts[]; charging: number; at: number } | null {
  if (!history || !groups.length) return null
  const lastAll = history.all[history.all.length - 1]
  if (!lastAll || now - lastAll.at > ESTIMATE_MAX_AGE_MS) return null
  const busyByKw = new Map<number, number>()
  for (const [kw, pts] of history.byKw) {
    const last = pts[pts.length - 1]
    // Chuỗi theo kW chỉ có điểm khi số đổi — điểm cuối cũ vẫn là giá trị hiện tại, miễn
    // chuỗi gộp còn tươi (đã kiểm ở trên).
    if (last) busyByKw.set(kw, last.cars)
  }
  // Không có chuỗi theo kW: chỉ ước tính được khi trạm có đúng một mức công suất.
  if (!busyByKw.size) {
    if (groups.length !== 1) return null
    busyByKw.set(groups[0].kw, lastAll.cars)
  }
  const ports = groups
    .map((g) => {
      const busy = Math.min(g.count, busyByKw.get(g.kw) ?? 0)
      return { kw: g.kw, free: g.count - busy, total: g.count }
    })
    .sort((a, b) => b.kw - a.kw)
  // Số không đổi từ điểm cuối tới lúc lấy lịch sử (cache ≤ 2') — tính là số của lúc này.
  return { ports, charging: lastAll.cars, at: now }
}

// ------------------------------------------------------------ thống kê 24h

export interface HourSlot {
  hour: number
  avg: number | null
  thin: boolean
}

export interface HistoryStats {
  peak: number
  avg: number
  peakHour: number | null
  quietHour: number | null
  /** null khi không biết tổng số cổng. */
  fillRate: number | null
  byHour: HourSlot[]
  /** Tỉ lệ 24h thật sự có dữ liệu dùng được. */
  coverage: number
  deadMinutes: number
}

/** Đoạn 0 xe dài ≥ 20' ngay sau lúc đang đông (≥ 3 xe) = MẤT DỮ LIỆU, không phải trạm vắng. */
const ZERO_GAP_MS = 20 * 60_000
const ZERO_DROP_FROM = 3
/** Khung giờ dưới 5' dữ liệu thì không xếp hạng. */
const THIN_MS = 5 * 60_000

/** Giờ Việt Nam (UTC+7, không đổi giờ mùa hè) của một mốc thời gian. */
const vnHour = (t: number) => new Date(t + 7 * 3600_000).getUTCHours()

function deadIntervals(p: HistoryPoint[]): boolean[] {
  const dead = new Array<boolean>(p.length).fill(false)
  let i = 0
  while (i < p.length) {
    if (p[i].cars !== 0) {
      i++
      continue
    }
    let j = i
    while (j + 1 < p.length && p[j + 1].cars === 0) j++
    const before = i > 0 ? p[i - 1].cars : 0
    if (p[j].at - p[i].at >= ZERO_GAP_MS && before >= ZERO_DROP_FROM) for (let k = i; k < j; k++) dead[k] = true
    i = j + 1
  }
  return dead
}

/**
 * Mẫu KHÔNG đều (trung vị ~23 s nhưng có khoảng tới 18'): mọi trung bình ở đây tính theo
 * THỜI GIAN, không theo số điểm — tính theo điểm lệch về phía đoạn được lấy mẫu dày.
 */
export function analyseHistory(p: HistoryPoint[], totalPorts: number | null): HistoryStats | null {
  if (p.length < 2) return null
  const dead = deadIntervals(p)
  const binMs = new Array<number>(24).fill(0)
  const binSum = new Array<number>(24).fill(0)
  let liveMs = 0
  let deadMs = 0
  let sum = 0
  let peak = 0
  for (let i = 0; i < p.length - 1; i++) {
    const dt = p[i + 1].at - p[i].at
    if (dt <= 0) continue
    if (dead[i]) {
      deadMs += dt
      continue
    }
    const v = p[i].cars
    liveMs += dt
    sum += v * dt
    if (v > peak) peak = v
    const h = vnHour(p[i].at)
    binMs[h] += dt
    binSum[h] += v * dt
  }
  if (liveMs === 0) return null
  const avg = sum / liveMs
  const byHour = binMs.map((ms, hour) => ({ hour, avg: ms > 0 ? binSum[hour] / ms : null, thin: ms < THIN_MS }))
  const ranked = byHour.filter((s) => s.avg !== null && !s.thin).sort((a, b) => b.avg! - a.avg!)
  return {
    peak,
    avg,
    peakHour: ranked[0]?.hour ?? null,
    quietHour: ranked[ranked.length - 1]?.hour ?? null,
    fillRate: totalPorts && totalPorts > 0 ? avg / totalPorts : null,
    byHour,
    coverage: liveMs / (liveMs + deadMs),
    deadMinutes: Math.round(deadMs / 60_000),
  }
}

/** Các khoảng xem lịch sử (giờ gần nhất). */
export const HISTORY_RANGES = [6, 12, 24] as const
export type HistoryRange = (typeof HISTORY_RANGES)[number]

/**
 * Cắt chuỗi về `hours` giờ gần nhất để thống kê đúng khoảng đó. EVCS chỉ ghi điểm khi số xe
 * ĐỔI nên: (1) thêm điểm ở mốc cắt mang giá trị đang có lúc đó, (2) kéo giá trị cuối tới
 * "bây giờ" (nếu điểm cuối chưa quá cũ) — không thì đoạn yên nhất (thường là lúc này) bị bỏ.
 */
export function windowHistory(p: HistoryPoint[], hours: number, now = Date.now()): HistoryPoint[] {
  if (!p.length) return p
  const from = now - hours * 3600_000
  const out: HistoryPoint[] = []
  let before: HistoryPoint | null = null
  for (const pt of p) {
    if (pt.at < from) before = pt
    else out.push(pt)
  }
  if (before) out.unshift({ at: from, cars: before.cars })
  const last = out[out.length - 1]
  if (last && last.at < now && now - last.at <= ESTIMATE_MAX_AGE_MS) out.push({ at: now, cars: last.cars })
  return out
}

// ------------------------------------------------------------ hook bảng trạm

export interface LiveState {
  live: LiveStatus | null
  liveLoading: boolean
  liveError: string | null
  history: LiveHistory | null
  historyLoading: boolean
  historyError: string | null
  retry: () => void
}

/**
 * Chỉ gọi khi người dùng MỞ một trạm (không quét nền — EVCS giới hạn nhịp). Hai đường riêng:
 * số cổng trống (REST, nhanh) hiện ngay, không chờ biểu đồ (WebSocket, chậm hơn).
 */
export function useLiveStatus(storeId: string | null, enabled: boolean): LiveState {
  const [live, setLive] = useState<LiveStatus | null>(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [history, setHistory] = useState<LiveHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const shownFor = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !storeId) return
    // Trạm khác: xoá số của trạm cũ ngay, đừng để "trống 5/10" của trạm trước lơ lửng.
    if (shownFor.current !== storeId) {
      setLive(null)
      setHistory(null)
      shownFor.current = storeId
    }
    const ctrl = new AbortController()
    const msg = (e: unknown) => (e instanceof LiveError ? e.message : MSG.failed)
    setLiveLoading(true)
    setLiveError(null)
    fetchLive(storeId, ctrl.signal)
      .then(setLive)
      .catch((e) => !ctrl.signal.aborted && setLiveError(msg(e)))
      .finally(() => !ctrl.signal.aborted && setLiveLoading(false))
    setHistoryLoading(true)
    setHistoryError(null)
    fetchHistory(storeId, ctrl.signal)
      .then(setHistory)
      .catch((e) => !ctrl.signal.aborted && setHistoryError(msg(e)))
      .finally(() => !ctrl.signal.aborted && setHistoryLoading(false))
    return () => ctrl.abort()
  }, [storeId, enabled, nonce])

  const retry = useCallback(() => setNonce((n) => n + 1), [])
  return { live, liveLoading, liveError, history, historyLoading, historyError, retry }
}
