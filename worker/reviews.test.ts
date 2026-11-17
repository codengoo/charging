import { describe, expect, it } from 'vitest'
import { parseCursor } from './reviews'

describe('parseCursor', () => {
  it('đọc dạng mới <updatedAt>_<id>', () => {
    expect(parseCursor('1731830400000_42')).toEqual({ at: 1731830400000, id: 42 })
  })
  it('dạng cũ chỉ updatedAt → id vô cực (lấy hết bài cùng mốc)', () => {
    expect(parseCursor('1731830400000')).toEqual({ at: 1731830400000, id: Number.MAX_SAFE_INTEGER })
  })
  it('rác / rỗng → null', () => {
    expect(parseCursor(null)).toBeNull()
    expect(parseCursor('')).toBeNull()
    expect(parseCursor('abc')).toBeNull()
    expect(parseCursor('1_2_3')).toBeNull()
    expect(parseCursor('-5')).toBeNull()
  })
})
