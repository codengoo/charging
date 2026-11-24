import { describe, expect, it } from 'vitest'
import { RECENT_MAX, parseRecent, pushRecent } from '@/data/recent'

describe('parseRecent', () => {
  it('không phải mảng / phần tử sai kiểu → bỏ', () => {
    expect(parseRecent(null)).toEqual([])
    expect(parseRecent({ a: 1 })).toEqual([])
    expect(parseRecent(['1', 2, '', '3'])).toEqual(['1', '3'])
  })
})

describe('pushRecent', () => {
  it('đưa lên đầu, bỏ trùng', () => {
    expect(pushRecent(['1', '2', '3'], '2')).toEqual(['2', '1', '3'])
  })
  it(`giữ tối đa ${RECENT_MAX}`, () => {
    const many = Array.from({ length: RECENT_MAX }, (_, i) => String(i))
    const next = pushRecent(many, 'new')
    expect(next).toHaveLength(RECENT_MAX)
    expect(next[0]).toBe('new')
    expect(next).not.toContain(String(RECENT_MAX - 1))
  })
})
