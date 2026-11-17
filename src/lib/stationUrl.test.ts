import { describe, expect, it } from 'vitest'
import {
  SITE_URL,
  googleMapsUrl,
  parseStationId,
  readTripLink,
  shareOrigin,
  slugify,
  stationPath,
  tripPath,
} from '@/lib/stationUrl'

describe('slugify', () => {
  it('hạ dấu tiếng Việt, đ → d, gạch nối', () => {
    expect(slugify('Vincom Hầm B3')).toBe('vincom-ham-b3')
    expect(slugify('Đường Láng – Đống Đa')).toBe('duong-lang-dong-da')
  })
  it('bỏ gạch đầu/cuối, rỗng khi không còn chữ', () => {
    expect(slugify('  ...Trạm sạc!!  ')).toBe('tram-sac')
    expect(slugify('!!!')).toBe('')
  })
  it('cắt tối đa 80 ký tự, không để gạch cuối', () => {
    const s = slugify('a'.repeat(79) + ' bcd')
    expect(s.length).toBeLessThanOrEqual(80)
    expect(s.endsWith('-')).toBe(false)
    expect(s).toBe('a'.repeat(79))
  })
})

describe('parseStationId', () => {
  it('đọc id từ /station/<id>-<slug>, có hoặc không slug / gạch chéo cuối', () => {
    expect(parseStationId('/station/12345-vincom-ham-b3')).toBe('12345')
    expect(parseStationId('/station/12345')).toBe('12345')
    expect(parseStationId('/station/12345/')).toBe('12345')
  })
  it('tiền tố /en', () => {
    expect(parseStationId('/en/station/987-x')).toBe('987')
  })
  it('không khớp → null', () => {
    expect(parseStationId('/station/abc')).toBeNull()
    expect(parseStationId('/tram/123-x')).toBeNull()
    expect(parseStationId('/station/123-x/extra')).toBeNull()
    expect(parseStationId('/')).toBeNull()
  })
})

describe('stationPath / tripPath / readTripLink', () => {
  it('stationPath theo ngôn ngữ', () => {
    expect(stationPath({ entityId: '42', name: 'Vincom Hầm B3' }, 'vi')).toBe('/station/42-vincom-ham-b3')
    expect(stationPath({ entityId: '42', name: '!!!' }, 'en')).toBe('/en/station/42')
  })
  it('tripPath mã hoá link', () => {
    expect(tripPath(null, 'vi')).toBe('/trip')
    expect(tripPath('https://maps.app.goo.gl/x?a=1&b=2', 'en')).toBe(
      '/en/trip?link=https%3A%2F%2Fmaps.app.goo.gl%2Fx%3Fa%3D1%26b%3D2',
    )
  })
  it('readTripLink: undefined ngoài /trip; link > url > text; null khi trống', () => {
    expect(readTripLink({ pathname: '/', search: '?link=x' })).toBeUndefined()
    expect(readTripLink({ pathname: '/trip', search: '?url=u&text=t' })).toBe('u')
    expect(readTripLink({ pathname: '/en/trip/', search: '?text=t' })).toBe('t')
    expect(readTripLink({ pathname: '/trip', search: '?link=l&url=u' })).toBe('l')
    expect(readTripLink({ pathname: '/trip', search: '' })).toBeNull()
  })
  it('googleMapsUrl, shareOrigin khi không có location (Worker / node)', () => {
    expect(googleMapsUrl({ lat: 21.1, lng: 105.5 })).toBe('https://www.google.com/maps/search/?api=1&query=21.1,105.5')
    expect(shareOrigin()).toBe(SITE_URL)
  })
})
