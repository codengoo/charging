import { describe, expect, it } from 'vitest'
import { RECENT_TRIPS_MAX, parseTrips, pushTrip } from '@/data/recentTrips'

const t = (link: string, label = link, at = 1) => ({ link, label, at })

describe('parseTrips', () => {
  it('bỏ phần tử sai kiểu', () => {
    expect(parseTrips('x')).toEqual([])
    expect(parseTrips([t('a'), { link: 'b' }, null, t('c')])).toEqual([t('a'), t('c')])
  })
})

describe('pushTrip', () => {
  it('lên đầu, cùng link thì thay bản cũ', () => {
    expect(pushTrip([t('a'), t('b', 'B cũ')], t('b', 'B mới', 2))).toEqual([t('b', 'B mới', 2), t('a')])
  })
  it(`tối đa ${RECENT_TRIPS_MAX}`, () => {
    const many = Array.from({ length: RECENT_TRIPS_MAX }, (_, i) => t(String(i)))
    expect(pushTrip(many, t('new'))).toHaveLength(RECENT_TRIPS_MAX)
  })
})
