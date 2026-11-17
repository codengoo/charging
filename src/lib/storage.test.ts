import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readJson, readStr, removeKey, writeJson, writeStr } from './storage'

const mem = new Map<string, string>()
const fake = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
}

describe('storage', () => {
  beforeEach(() => {
    mem.clear()
    ;(globalThis as { localStorage?: unknown }).localStorage = fake
  })
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it('ghi rồi đọc chuỗi / JSON', () => {
    expect(writeStr('a', 'x')).toBe(true)
    expect(readStr('a')).toBe('x')
    writeJson('b', { n: 1 })
    expect(readJson('b')).toEqual({ n: 1 })
    removeKey('a')
    expect(readStr('a')).toBeNull()
  })
  it('JSON hỏng / thiếu khoá → null', () => {
    mem.set('bad', '{oops')
    expect(readJson('bad')).toBeNull()
    expect(readJson('none')).toBeNull()
  })
  it('localStorage bị chặn → đọc null, ghi false, không ném', () => {
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }
    expect(readStr('a')).toBeNull()
    expect(readJson('a')).toBeNull()
    expect(writeStr('a', 'x')).toBe(false)
    expect(() => removeKey('a')).not.toThrow()
  })
  it('không có localStorage (Worker / node) → null', () => {
    delete (globalThis as { localStorage?: unknown }).localStorage
    expect(readStr('a')).toBeNull()
    expect(writeJson('a', 1)).toBe(false)
  })
})
