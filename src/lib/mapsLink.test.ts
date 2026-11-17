import { describe, expect, it } from 'vitest'
import { NO_AVOID, firstUrl, hasFix, isShortLink, parseMapsUrl } from '@/lib/mapsLink'
import * as F from '@/lib/__fixtures__/maps-links'

describe('firstUrl', () => {
  it('rút link đầu tiên ra khỏi đoạn chia sẻ, bỏ dấu câu cuối', () => {
    expect(firstUrl(F.SHARE_TEXT_SHORT)).toBe(F.SHORT_LINK)
    expect(firstUrl('xem (https://example.com/a),')).toBe('https://example.com/a')
  })
  it('không có link → null', () => {
    expect(firstUrl('Vincom Plaza Long Biên')).toBeNull()
  })
})

describe('isShortLink', () => {
  it('nhận maps.app.goo.gl / goo.gl / g.co', () => {
    expect(isShortLink(F.SHORT_LINK)).toBe(true)
    expect(isShortLink(F.SHORT_LINK_IOS)).toBe(true)
    expect(isShortLink('https://goo.gl/maps/abc')).toBe(true)
    expect(isShortLink('https://g.co/kgs/abc')).toBe(true)
  })
  it('link đầy đủ hoặc chuỗi hỏng → false', () => {
    expect(isShortLink(F.DIR_PB_THREE_STOPS)).toBe(false)
    expect(isShortLink('not a url')).toBe(false)
  })
})

describe('hasFix', () => {
  it('cần cả lat và lng hữu hạn', () => {
    expect(hasFix({ lat: 21, lng: 105 })).toBe(true)
    expect(hasFix({ lat: 21 })).toBe(false)
    expect(hasFix({ lat: NaN, lng: 105 })).toBe(false)
    expect(hasFix({ text: 'Hà Nội' })).toBe(false)
  })
})

describe('parseMapsUrl — chỉ đường có khối data=', () => {
  it('toạ độ chặng lấy từ !2m2!1d<lng>!2d<lat>, tên giải mã từ path', () => {
    const p = parseMapsUrl(F.DIR_PB_THREE_STOPS)!
    expect(p.stops).toEqual([
      { lat: 21.0277644, lng: 105.8341598, text: 'Hà Nội' },
      { lat: 20.5411, lng: 105.9122, text: 'Phủ Lý, Hà Nam' },
      { lat: 20.2506, lng: 105.9745, text: 'Ninh Bình' },
    ])
  })
  it('điểm kéo tuyến !3m… gắn vào chặng đứng trước, không bị lấy làm toạ độ chặng', () => {
    const p = parseMapsUrl(F.DIR_PB_THREE_STOPS)!
    expect(p.vias).toEqual([[{ lat: 20.9003, lng: 105.8812 }], [], []])
  })
  it('cờ tránh !1b1 cao tốc, !2b1 thu phí; !5iN là tuyến đang chọn', () => {
    const p = parseMapsUrl(F.DIR_PB_THREE_STOPS)!
    expect(p.avoid).toEqual({ highway: true, toll: true, ferry: false })
    expect(p.googleRoute).toBe(1)
  })
  it('chặng toạ độ trần (!1m0) giữ toạ độ trong path, không có tên', () => {
    const p = parseMapsUrl(F.DIR_PB_BARE_ORIGIN)!
    expect(p.stops).toEqual([
      { lat: 21.007587, lng: 105.800847 },
      { lat: 21.0471, lng: 105.9161, text: 'Vincom Plaza Long Biên' },
    ])
    expect(p.vias).toEqual([[], []])
    expect(p.avoid).toEqual(NO_AVOID)
    expect(p.googleRoute).toBeNull()
  })
  it('số waypoint lệch số chặng: toạ độ ăn theo thứ tự, chặng thừa chỉ còn tên, bỏ điểm kéo', () => {
    const p = parseMapsUrl(F.DIR_PB_MISALIGNED)!
    expect(p.stops).toEqual([
      { lat: 21.0277644, lng: 105.8341598, text: 'Hà Nội' },
      { lat: 20.5411, lng: 105.9122, text: 'Phủ Lý' },
      { text: 'Ninh Bình' },
    ])
    expect(p.vias).toEqual([[], [], []])
  })
  it('không có khối chỉ đường → dự phòng bằng cặp !3d!4d', () => {
    const p = parseMapsUrl(F.DIR_3D4D_ONLY)!
    expect(p.stops).toEqual([{ lat: 21.0287, lng: 105.8524, text: 'Hồ Gươm' }])
  })
  it('khung nhìn @… không bị coi là một chặng', () => {
    const p = parseMapsUrl(F.DIR_PB_THREE_STOPS)!
    expect(p.stops).toHaveLength(3)
  })
})

describe('parseMapsUrl — ?api=1', () => {
  it('origin | waypoints | destination theo thứ tự', () => {
    const p = parseMapsUrl(F.DIR_API1)!
    expect(p.stops).toEqual([
      { lat: 21.0285, lng: 105.8542 },
      { text: 'Phủ Lý' },
      { lat: 20.25, lng: 105.97 },
      { text: 'Thanh Hóa' },
    ])
    expect(p.vias).toEqual([[], [], [], []])
    expect(p.avoid).toEqual(NO_AVOID)
  })
})

describe('parseMapsUrl — link iOS saddr/daddr/geocode', () => {
  it('geocode khớp số chặng → toạ độ gán cho chặng có tên', () => {
    const p = parseMapsUrl(F.IOS_LEGACY)!
    expect(p.stops).toHaveLength(2)
    expect(p.stops[0]).toEqual({ lat: 21.007587, lng: 105.800847 })
    expect(p.stops[1].text).toBe('Thanh Vân, Tam Đảo, Vĩnh Phúc')
    expect(p.stops[1].lat).toBeCloseTo(F.IOS_LEGACY_DEST.lat, 6)
    expect(p.stops[1].lng).toBeCloseTo(F.IOS_LEGACY_DEST.lng, 6)
    expect(p.avoid).toEqual(NO_AVOID)
  })
  it('" to:" nối nhiều điểm; geocode lệch → chỉ giữ tên; dirflg h/t → tránh', () => {
    const p = parseMapsUrl(F.IOS_LEGACY_MULTI)!
    expect(p.stops).toEqual([{ text: 'Hà Nội' }, { text: 'Phủ Lý' }, { text: 'Ninh Bình' }])
    expect(p.avoid).toEqual({ highway: true, toll: true, ferry: false })
    expect(p.vias).toEqual([[], [], []])
  })
})

describe('parseMapsUrl — một địa điểm', () => {
  it('ưu tiên ghim !3d!4d hơn khung nhìn @', () => {
    const p = parseMapsUrl(F.PLACE)!
    expect(p.stops).toEqual([{ lat: 21.0471, lng: 105.9161, text: 'Vincom Plaza Long Biên' }])
    expect(p.googleRoute).toBeNull()
  })
  it('chỉ có khung nhìn @ thì dùng nó', () => {
    expect(parseMapsUrl(F.PLACE_VIEW_ONLY)!.stops).toEqual([{ lat: 21.0545, lng: 105.8188, text: 'Hồ Tây' }])
  })
  it('?q=lat,lng', () => {
    expect(parseMapsUrl(F.SEARCH_Q)!.stops).toEqual([{ lat: 20.9733, lng: 105.8468 }])
  })
})

describe('parseMapsUrl — không đọc được', () => {
  it('chuỗi không phải URL, link không có gì → null', () => {
    expect(parseMapsUrl('hello')).toBeNull()
    expect(parseMapsUrl('https://www.google.com/maps')).toBeNull()
  })
  it('link rút gọn chưa mở → null (phải mở qua Worker trước)', () => {
    expect(parseMapsUrl(F.SHORT_LINK)).toBeNull()
  })
})
