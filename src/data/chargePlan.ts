/**
 * Tự lên kế hoạch dừng sạc cho một hành trình. Tính hoàn toàn ở client trên danh sách trạm dọc
 * đường đã có (routeCorridor) — không gọi thêm HERE / EVCS.
 *
 * Thứ tự ưu tiên: ít lần sạc nhất → tổng thời gian sạc ngắn nhất → gần lộ trình gốc nhất (xem
 * planCharging). Trạm sát cao tốc phải ra nút giao (`viaExit`) mang quãng vòng ước tính
 * EXIT_ACCESS_KM mỗi chiều — vào pin, vào tiêu chí (3) và vào tổng thời gian chuyến.
 */
import { TARGET_PCT, arrivalPct, avgKmh, chargeMinutes, type ArrivalEstimate } from './battery'
import type { AlongRoute } from './routeCorridor'
import type { StationPower } from './types'
import type { Vehicle } from './vehicles'
import { dcMaxKw } from './stations'

/** Chỉ ghé trạm có cổng DC từ mức này — AC hay DC chậm thì một lần dừng mất hàng giờ. */
export const PLAN_MIN_DC_KW = 50

export interface PlanStop {
  item: AlongRoute
  /** % pin khi tới trạm. */
  arrive: ArrivalEstimate
  /** Cổng DC mạnh nhất của trạm. */
  kw: number
  /** Sạc tới mức này: 80%, hoặc vừa đủ tới đích ở điểm dừng cuối. */
  toPct: number
  /** Phút sạc; null = tới nơi đã đủ. */
  chargeMin: number | null
  /** Quãng vòng khỏi tuyến, cả đi lẫn về (km) — 2 × accessKm. */
  detourKm: number
}

export type ChargePlan =
  | { ok: true; stops: PlanStop[]; arriveDest: ArrivalEstimate; chargeMin: number; totalSeconds: number }
  | { ok: false; stops: PlanStop[]; stuckAtKm: number }

/**
 * Trạm sát cao tốc phải ra nút giao (`viaExit`): mỗi chiều cộng thêm chừng này km ngoài độ lệch —
 * ước tính chạy tới nút giao rồi quay lại (nút giao cao tốc VN thường cách nhau 10–20 km). Chỉ là
 * quy tắc, không hỏi HERE quãng vòng thật.
 */
export const EXIT_ACCESS_KM = 2.5

/** Km từ tuyến vào tới trạm (một chiều): độ lệch, cộng quãng ra nút giao nếu phải ra cao tốc. */
export function accessKm(item: Pick<AlongRoute, 'offsetKm' | 'viaExit'>): number {
  return item.offsetKm + (item.viaExit ? EXIT_ACCESS_KM : 0)
}

/**
 * Km đã lái khi NGANG QUA một trạm dọc tuyến: rẽ vào rồi quay ra tuyến (2 × accessKm). Bảng Dọc
 * đường dùng số này cho "% khi ngang qua" và vạch "Trạm cuối còn kịp" — bi quan hơn kế hoạch sạc,
 * vốn tính tới trạm (`atKm + accessKm`) rồi cộng đoạn quay ra vào chặng sau.
 */
export const passByKm = (item: Pick<AlongRoute, 'atKm' | 'offsetKm' | 'viaExit'>): number => item.atKm + 2 * accessKm(item)

/** Trạm sau phải xa hơn trạm trước ít nhất chừng này — tránh "ghé" lại trạm cạnh nhau. */
const MIN_HOP_KM = 1
const MAX_STOPS = 30
/** Ngoài mức "vừa đủ tới trạm kế", mỗi lần dừng thử sạc thêm lên các mức này (≤ TARGET_PCT). */
const CHARGE_LEVELS = [50, 60, 70, TARGET_PCT]

/** Nhãn so sánh theo thứ tự từ điển trong cùng một lớp (cùng số lần sạc). */
interface Cost {
  chargeMin: number
  detourKm: number
}
const EPS = 1e-9
/**
 * Phút sạc chênh dưới chừng này coi như bằng nhau (vd. chênh do biên ước tính bi quan) — không đáng
 * để chọn trạm phải vòng xa hơn; khi đó xét tiêu chí (3) quãng vòng, rồi mới tới phút sạc.
 */
const CHARGE_TIE_MIN = 1
const better = (a: Cost, b: Cost) => {
  const d = a.chargeMin - b.chargeMin
  if (Math.abs(d) >= CHARGE_TIE_MIN) return d < 0
  if (Math.abs(a.detourKm - b.detourKm) > EPS) return a.detourKm < b.detourKm
  return d < -EPS
}

/** Đã tới trạm `i` (chỉ số trong danh sách ứng viên; -1 = điểm xuất phát) với ước tính pin `arrive`. */
interface Label extends Cost {
  i: number
  arrive: ArrivalEstimate
  /** % pin (giữa khoảng ước tính) khi tới — điểm bắt đầu sạc. */
  mid: number
  /** Các điểm dừng TRƯỚC trạm này (đã chốt mức sạc). */
  stops: PlanStop[]
}

/**
 * `items` phải xếp theo `atKm` (như alongRoute trả). Chọn kế hoạch theo thứ tự ưu tiên:
 *   (1) ít lần sạc nhất → (2) tổng phút sạc ngắn nhất → (3) tổng km vòng khỏi tuyến ít nhất.
 *
 * Duyệt theo LỚP số lần sạc: lớp k = mọi trạng thái (trạm, % pin khi tới làm tròn 1%) tới được với
 * đúng k lần sạc; lớp nhỏ nhất tới được đích là lời giải, nên (1) được bảo đảm. Trong lớp, mỗi trạng
 * thái giữ nhãn tốt nhất theo (2) rồi (3); trạng thái đã gặp ở lớp ít lần sạc hơn thì bỏ (luôn tốt
 * hơn). Mỗi lần dừng thử sạc lên "vừa đủ tới trạm kế" và các mức CHARGE_LEVELS — tối đa 80%; lần
 * cuối sạc vừa đủ tới đích còn ≥ `reservePct`. An toàn: ước tính BI QUAN khi tới phải ≥ `reservePct`;
 * phút sạc tính từ % giữa khoảng ước tính, theo đường cong sạc của xe.
 *
 * Quãng tới một trạm = đoạn trên tuyến + accessKm (rẽ vào; cộng quãng ra nút giao nếu `viaExit`);
 * rời trạm thì chặng sau cộng accessKm đó (quay ra). Tốc độ trung bình = cả tuyến.
 */
export function planCharging(
  items: AlongRoute[],
  power: Map<string, StationPower> | null,
  route: { meters: number; seconds: number },
  startPct: number,
  v: Vehicle,
  climate: boolean,
  /** Pin dự phòng tối thiểu (%) — Settings.reservePct. */
  reservePct: number,
): ChargePlan {
  const totalKm = route.meters / 1000
  const speed = avgKmh(route.meters, route.seconds)
  const cands = items
    .map((item) => ({ item, kw: dcMaxKw(power?.get(item.station.entityId)), access: accessKm(item) }))
    .filter((c) => c.kw >= PLAN_MIN_DC_KW)

  const arrive = (from: number, km: number) => arrivalPct(from, km, speed, v, climate)
  /** % pin cần lúc rời đi để đi `km` mà còn ≥ reservePct theo ước tính bi quan. */
  const need = (km: number) => reservePct + (100 - arrive(100, km).low)
  const done = (stops: PlanStop[], arriveDest: ArrivalEstimate, chargeMin: number): ChargePlan => {
    const detourSeconds = stops.reduce((t, s) => (s.item.viaExit ? t + (s.detourKm / speed) * 3600 : t), 0)
    return { ok: true, stops, arriveDest, chargeMin, totalSeconds: route.seconds + detourSeconds + chargeMin * 60 }
  }

  /** Điểm dừng ở trạm của nhãn `l`, sạc lên `toPct`. */
  const stopAt = (l: Label, toPct: number): PlanStop => {
    const c = cands[l.i]
    return {
      item: c.item,
      arrive: l.arrive,
      kw: c.kw,
      toPct: Math.round(toPct),
      chargeMin: chargeMinutes(l.mid, { kw: c.kw, dc: true }, v, toPct),
      detourKm: 2 * c.access,
    }
  }

  // Không cần dừng.
  const direct = arrive(startPct, totalKm)
  if (direct.low >= reservePct) return done([], direct, 0)

  const seen = new Set<number>()
  const keyOf = (i: number, mid: number) => i * 1000 + Math.round(mid)

  /** Rời nhãn `from` với `leave`% pin (sau khi dừng `stopHere` nếu có) → nhãn ở các trạm phía sau. */
  const expand = (from: Label, leave: number, stopHere: PlanStop | null, next: Map<number, Label>) => {
    const pos = from.i < 0 ? 0 : cands[from.i].item.atKm
    const rejoin = from.i < 0 ? 0 : cands[from.i].access
    const stops = stopHere ? [...from.stops, stopHere] : from.stops
    const cost: Cost = {
      chargeMin: from.chargeMin + (stopHere?.chargeMin ?? 0),
      detourKm: from.detourKm + (stopHere?.detourKm ?? 0),
    }
    for (let j = from.i + 1; j < cands.length; j++) {
      const c = cands[j]
      if (c.item.atKm < pos + MIN_HOP_KM) continue
      // Xa hơn nữa trên tuyến cũng không tới được — dừng quét.
      if (arrive(leave, rejoin + c.item.atKm - pos).low < reservePct) break
      const a = arrive(leave, rejoin + c.item.atKm - pos + c.access)
      if (a.low < reservePct) continue
      const mid = (a.low + a.high) / 2
      const key = keyOf(j, mid)
      if (seen.has(key)) continue
      const label: Label = { i: j, arrive: a, mid, stops, ...cost }
      const cur = next.get(key)
      if (!cur || better(label, cur)) next.set(key, label)
    }
  }

  let layer = new Map<number, Label>()
  expand({ i: -1, arrive: direct, mid: startPct, stops: [], chargeMin: 0, detourKm: 0 }, startPct, null, layer)
  /** Nhãn ở trạm xa nhất từng tới — báo kẹt kèm các điểm dừng đi được tới đó. */
  let farthest: Label | null = null

  for (let k = 1; k <= MAX_STOPS && layer.size > 0; k++) {
    for (const key of layer.keys()) seen.add(key)

    // Lớp k tới được đích? Lấy kế hoạch tốt nhất theo (phút sạc, km vòng).
    let best: { stops: PlanStop[]; arriveDest: ArrivalEstimate; cost: Cost } | null = null
    for (const l of layer.values()) {
      const c = cands[l.i]
      if (!farthest || c.item.atKm > cands[farthest.i].item.atKm) farthest = l
      const toDest = c.access + Math.max(0, totalKm - c.item.atKm)
      // Làm tròn lên: tới đích còn ≥ mức dự phòng một chút, không sát đúng.
      const leave = Math.max(l.mid, Math.ceil(need(toDest)))
      if (leave > TARGET_PCT + EPS) continue
      const stop = stopAt(l, leave)
      const cost: Cost = { chargeMin: l.chargeMin + (stop.chargeMin ?? 0), detourKm: l.detourKm + stop.detourKm }
      if (!best || better(cost, best.cost)) best = { stops: [...l.stops, stop], arriveDest: arrive(leave, toDest), cost }
    }
    if (best) return done(best.stops, best.arriveDest, best.cost.chargeMin)

    // Chưa tới được: dừng thêm một lần ở mỗi trạng thái của lớp này.
    const next = new Map<number, Label>()
    for (const l of layer.values()) {
      const c = cands[l.i]
      const levels = new Set<number>()
      for (let j = l.i + 1; j < cands.length; j++) {
        const n = cands[j]
        if (n.item.atKm < c.item.atKm + MIN_HOP_KM) continue
        const lv = Math.ceil(need(c.access + n.item.atKm - c.item.atKm + n.access))
        if (lv > TARGET_PCT) break
        if (lv > l.mid + 0.5) levels.add(lv)
      }
      for (const lv of CHARGE_LEVELS) if (lv > l.mid + 0.5) levels.add(lv)
      for (const lv of levels) expand(l, lv, stopAt(l, lv), next)
    }
    layer = next
  }
  if (!farthest) return { ok: false, stops: [], stuckAtKm: 0 }
  // Kẹt: các điểm dừng tới trạm xa nhất với được, ở đó sạc đầy 80% vẫn không đi tiếp được.
  const last = farthest.mid < TARGET_PCT ? [stopAt(farthest, TARGET_PCT)] : []
  return { ok: false, stops: [...farthest.stops, ...last], stuckAtKm: cands[farthest.i].item.atKm }
}
