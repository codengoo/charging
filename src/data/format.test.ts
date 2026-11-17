import { describe, expect, it } from 'vitest'
// Builder là .mjs thuần Node — test khứ hồi để hai bên không lệch định dạng.
// @ts-expect-error .mjs không có .d.ts — kiểu của builder kiểm riêng bằng `tsc -p builder`.
import { groupsString, packGroups } from '../../builder/lib/build.mjs'
import { parsePowerGroups } from './format'

describe('định dạng cột groups (builder ↔ client)', () => {
  it('pack rồi parse ra đúng nhóm, gộp trùng kW+DC, sắp kW giảm dần', () => {
    const packed = packGroups([
      [60, 2, 1],
      [250, 1, 1],
      [60, 2, 1],
      [11, 4, 0],
    ])
    const s = groupsString(packed)
    expect(s).toBe('250:1:1|60:4:1|11:4:0')
    expect(parsePowerGroups(s)).toEqual([
      { kw: 250, count: 1, dc: true },
      { kw: 60, count: 4, dc: true },
      { kw: 11, count: 4, dc: false },
    ])
  })
  it('chuỗi rỗng → không nhóm', () => {
    expect(parsePowerGroups('')).toEqual([])
  })
  it('bỏ phần hỏng, giữ phần đúng', () => {
    expect(parsePowerGroups('x:y:1|30:2:0')).toEqual([{ kw: 30, count: 2, dc: false }])
  })
})
