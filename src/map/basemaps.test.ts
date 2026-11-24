import { describe, expect, it } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'
import { SATELLITE_TILES, satelliteStyle, styleKey } from '@/map/basemaps'

const base = {
  version: 8,
  glyphs: 'https://glyphs/{fontstack}/{range}.pbf',
  sprite: 'https://sprite',
  sources: { openmaptiles: { type: 'vector', url: 'https://tiles' } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#fff' } },
    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water' },
    { id: 'road-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', paint: { 'text-color': '#333' } },
    { id: 'place-city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place' },
    { id: 'poi', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi' },
  ],
} as unknown as StyleSpecification

describe('satelliteStyle', () => {
  const s = satelliteStyle(base)
  it('ảnh vệ tinh dưới cùng, chỉ giữ nhãn địa danh / đường', () => {
    expect(s.layers.map((l) => l.id)).toEqual(['satellite', 'road-label', 'place-city'])
    expect(s.sources.satellite).toMatchObject({ type: 'raster', tiles: [SATELLITE_TILES] })
  })
  it('giữ glyphs / sprite / nguồn vector; chữ trắng viền tối', () => {
    expect(s.glyphs).toBe(base.glyphs)
    expect(s.sources.openmaptiles).toBeDefined()
    const label = s.layers.find((l) => l.id === 'road-label') as { paint: Record<string, unknown> }
    expect(label.paint['text-color']).toBe('#ffffff')
  })
})

describe('styleKey', () => {
  it('đường phố / vệ tinh không đổi theo giao diện', () => {
    expect(styleKey('default', 'dark')).not.toBe(styleKey('default', 'light'))
    expect(styleKey('satellite', 'dark')).toBe(styleKey('satellite', 'light'))
  })
})
