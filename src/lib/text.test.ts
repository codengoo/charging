import { describe, expect, it } from 'vitest'
import { foldText, fromBase64Url, stripDiacritics, toBase64Url } from './text'

describe('text', () => {
  it('hạ dấu tiếng Việt, đ → d', () => {
    expect(stripDiacritics('Vincom Hầm B3 Đông Anh')).toBe('vincom ham b3 dong anh')
    expect(stripDiacritics('Ẩm thực Quảng Ngãi')).toBe('am thuc quang ngai')
  })
  it('foldText gộp khoảng trắng và cắt hai đầu', () => {
    expect(foldText('  Trạm   sạc\tLý Thái Tổ ')).toBe('tram sac ly thai to')
  })
  it('base64url khứ hồi, không dấu = + /', () => {
    const bytes = Uint8Array.from([0, 251, 255, 62, 63, 1, 2])
    const s = toBase64Url(bytes)
    expect(s).not.toMatch(/[=+/]/)
    expect([...fromBase64Url(s)]).toEqual([...bytes])
  })
  it('base64url hỏng → ném lỗi', () => {
    expect(() => fromBase64Url('***')).toThrow()
  })
})
