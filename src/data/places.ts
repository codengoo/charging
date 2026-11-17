/**
 * Địa điểm hay dùng: Nhà, Công ty (mỗi loại một) và tối đa PLACES_CUSTOM_MAX địa điểm tự đặt tên.
 * Dùng để tìm đường + trạm dọc đường nhanh (bảng Dọc đường), làm gốc cho "Gần tôi", và ghim trên bản
 * đồ. Chỉ nằm trong localStorage của máy; chuyển máy bằng sao lưu (backup.ts mang theo `places`).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { readJson, writeJson } from '../lib/storage'
import { pick } from '../i18n'

export type PlaceKind = 'home' | 'work' | 'custom'

export interface Place {
  /** 'home' / 'work' cho hai ô cố định; địa điểm tự đặt có id ngẫu nhiên. */
  id: string
  kind: PlaceKind
  /** Tên người dùng đặt — chỉ dùng cho `custom` (Nhà / Công ty lấy tên theo ngôn ngữ). */
  name: string
  lat: number
  lng: number
  /** Địa chỉ / tên chỗ để hiện dưới tên (từ HERE hoặc link). */
  address: string
  /** Lần sửa cuối (epoch ms) — gộp sao lưu giữ bản mới hơn. */
  at: number
}

export const PLACES_KEY = 'tramsac.places'
export const PLACES_CUSTOM_MAX = 8
export const PLACE_NAME_MAX = 30
const ADDRESS_MAX = 200

const KIND_NAME = pick({
  vi: { home: 'Nhà', work: 'Công ty' },
  en: { home: 'Home', work: 'Work' },
})

/** Tên hiện: Nhà / Công ty theo ngôn ngữ, địa điểm tự đặt theo tên người dùng. */
export function placeName(p: Pick<Place, 'kind' | 'name'>): string {
  return p.kind === 'custom' ? p.name : KIND_NAME[p.kind]
}

const okCoord = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && Number.isFinite(lat + lng)

/** Thứ tự hiện: Nhà, Công ty, rồi địa điểm tự đặt theo lúc thêm. */
function sorted(list: Place[]): Place[] {
  const rank = (p: Place) => (p.kind === 'home' ? 0 : p.kind === 'work' ? 1 : 2)
  return [...list].sort((a, b) => rank(a) - rank(b) || a.at - b.at)
}

/** Đọc từ JSON lạ (localStorage, file sao lưu): bỏ mục sai kiểu, Nhà / Công ty mỗi loại một, cắt chữ dài. */
export function parsePlaces(o: unknown): Place[] {
  if (!Array.isArray(o)) return []
  const byId = new Map<string, Place>()
  for (const x of o) {
    if (!x || typeof x !== 'object') continue
    const { id, kind, name, lat, lng, address, at } = x as Partial<Place>
    if (kind !== 'home' && kind !== 'work' && kind !== 'custom') continue
    if (!okCoord(lat, lng) || typeof at !== 'number') continue
    const pid = kind === 'custom' ? id : kind
    if (typeof pid !== 'string' || !pid) continue
    const nm = typeof name === 'string' ? name.trim().slice(0, PLACE_NAME_MAX) : ''
    if (kind === 'custom' && !nm) continue
    const prev = byId.get(pid)
    if (prev && prev.at >= at) continue
    byId.set(pid, { id: pid, kind, name: nm, lat: lat!, lng: lng!, address: typeof address === 'string' ? address.slice(0, ADDRESS_MAX) : '', at })
  }
  const list = sorted([...byId.values()])
  const custom = list.filter((p) => p.kind === 'custom').slice(0, PLACES_CUSTOM_MAX)
  return [...list.filter((p) => p.kind !== 'custom'), ...custom]
}

/** Gộp: chỉ có ở một bên thì lấy; có ở cả hai (cùng id) thì giữ bản sửa sau. Địa điểm tự đặt tối đa PLACES_CUSTOM_MAX. */
export function mergePlaces(mine: Place[], incoming: Place[]): Place[] {
  return parsePlaces([...mine, ...incoming])
}

/** Số địa điểm sẽ thêm / thay khi gộp — cho câu xác nhận nhập. */
export function newPlacesCount(mine: Place[], incoming: Place[]): number {
  const cur = new Map(mine.map((p) => [p.id, p]))
  return incoming.filter((p) => !cur.has(p.id) || cur.get(p.id)!.at < p.at).length
}

const load = (): Place[] => parsePlaces(readJson(PLACES_KEY))

export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>(load)

  // Updater phải THUẦN (StrictMode gọi hai lần) — ghi kho trong effect, thời điểm tính ở ngoài.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false // vừa đọc từ kho, không ghi lại
      return
    }
    writeJson(PLACES_KEY, places)
  }, [places])

  /** Thêm / thay. Nhà, Công ty ghi đè theo loại; địa điểm tự đặt mới cần `id` mới (newPlaceId). */
  const save = useCallback((p: Omit<Place, 'at'>) => {
    const at = Date.now()
    setPlaces((cur) => parsePlaces([...cur.filter((x) => x.id !== p.id), { ...p, at }]))
  }, [])

  const remove = useCallback((id: string) => setPlaces((cur) => cur.filter((p) => p.id !== id)), [])

  const merge = useCallback((incoming: Place[]) => setPlaces((cur) => mergePlaces(cur, incoming)), [])

  return { places, save, remove, merge }
}

/** Id cho địa điểm tự đặt mới. */
export function newPlaceId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
