import { describe, expect, it } from 'vitest'
// Builder là .mjs thuần Node — test khứ hồi để hai bên không lệch định dạng.
// @ts-expect-error .mjs không có .d.ts — kiểu của builder kiểm riêng bằng `tsc -p builder`.
import { contentHash, groupsString, packGroups } from '../../builder/lib/build.mjs'
import { dataKey, parsePowerGroups } from './format'

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

describe('tên file theo nội dung', () => {
  it('contentHash: 8 hex, cùng dữ liệu cùng hash, khác dữ liệu khác hash', async () => {
    const a = await contentHash({ rows: [[1, 2]] })
    expect(a).toMatch(/^[0-9a-f]{8}$/)
    expect(await contentHash({ rows: [[1, 2]] })).toBe(a)
    expect(await contentHash({ rows: [[1, 3]] })).not.toBe(a)
  })
  it('dataKey đổi khi chỉ tên power đổi (cùng generation)', () => {
    const m = { base: 'base-1-aaaa.json', power: 'power-1-bbbb.json' }
    expect(dataKey(m)).not.toBe(dataKey({ ...m, power: 'power-1-cccc.json' }))
    expect(dataKey(m)).toBe(dataKey({ ...m }))
  })
})
