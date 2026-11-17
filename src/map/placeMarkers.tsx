import maplibregl from 'maplibre-gl'
import { createRoot, type Root } from 'react-dom/client'
import { BriefcaseBusiness, House, MapPin } from 'lucide-react'
import type { PlaceKind } from '../data/places'

/** Địa điểm hay dùng vẽ trên bản đồ (Nhà, Công ty, tự đặt). */
export interface MapPlace {
  id: string
  kind: PlaceKind
  name: string
  lat: number
  lng: number
}

const ICON = { home: House, work: BriefcaseBusiness, custom: MapPin }

/**
 * Ghim địa điểm bằng Marker HTML của maplibre (≤ 10 điểm — không đáng làm layer GeoJSON): tròn
 * trắng, icon màu brand, tên nhỏ bên dưới. Đồng bộ theo danh sách mới mỗi lần gọi `sync`.
 */
export function createPlaceMarkers(map: maplibregl.Map, onClick: (id: string) => void) {
  const shown = new Map<string, { marker: maplibregl.Marker; root: Root; key: string }>()

  function sync(places: MapPlace[]) {
    const keep = new Set<string>()
    for (const p of places) {
      const key = `${p.kind}|${p.name}|${p.lat}|${p.lng}`
      keep.add(p.id)
      const cur = shown.get(p.id)
      if (cur?.key === key) continue
      if (cur) {
        cur.marker.remove()
        cur.root.unmount()
      }
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'flex flex-col items-center gap-0.5 outline-none'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onClick(p.id)
      })
      const root = createRoot(el)
      const Icon = ICON[p.kind]
      root.render(
        <>
          <span className="flex size-8 items-center justify-center rounded-full border-2 border-brand bg-card text-brand shadow-md">
            <Icon className="size-4" strokeWidth={2.5} aria-hidden />
          </span>
          <span className="rounded-md bg-card/90 px-1.5 text-[10px] leading-4 font-semibold text-foreground shadow-sm">{p.name}</span>
        </>,
      )
      const marker = new maplibregl.Marker({ element: el, anchor: 'top', offset: [0, -16] }).setLngLat([p.lng, p.lat]).addTo(map)
      // Marker gán aria-label "Map marker" mặc định — đặt lại tên địa điểm cho trình đọc màn hình.
      el.setAttribute('aria-label', p.name)
      shown.set(p.id, { marker, root, key })
    }
    for (const [id, cur] of shown) {
      if (keep.has(id)) continue
      cur.marker.remove()
      // Gỡ root sau lượt render hiện tại (React không cho unmount đồng bộ trong lúc render).
      queueMicrotask(() => cur.root.unmount())
      shown.delete(id)
    }
  }

  function destroy() {
    sync([])
  }

  return { sync, destroy }
}
