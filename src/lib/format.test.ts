import { describe, expect, it } from 'vitest'
import { fmtDistance, fmtKw } from '@/lib/format'

describe('format', () => {
  it('fmtDistance', () => {
    expect(fmtDistance(0.85)).toBe('850 m')
    expect(fmtDistance(3.24)).toBe('3.2 km')
  })
  it('fmtKw', () => {
    expect(fmtKw(120)).toBe('120')
    expect(fmtKw(7.4)).toBe('7.4')
  })
})
