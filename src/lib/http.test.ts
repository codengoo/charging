import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpError, errorText, fetchJson, isAbort } from './http'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const respond = (status: number, body?: string) =>
  (globalThis.fetch = vi.fn(async () => new Response(body ?? null, { status })) as typeof fetch)

describe('fetchJson', () => {
  it('200 → body JSON', async () => {
    respond(200, '{"a":1}')
    await expect(fetchJson('/x')).resolves.toEqual({ a: 1 })
  })
  it('204 → undefined', async () => {
    respond(204)
    await expect(fetchJson('/x')).resolves.toBeUndefined()
  })
  it('lỗi HTTP → HttpError kèm status + body', async () => {
    respond(429, '{"error":"Gọi quá nhanh"}')
    const e = await fetchJson('/x').catch((x: unknown) => x)
    expect(e).toBeInstanceOf(HttpError)
    expect((e as HttpError).status).toBe(429)
    expect(errorText(e)).toBe('Gọi quá nhanh')
  })
  it('200 mà body không phải JSON → HttpError(200)', async () => {
    respond(200, '<html>')
    const e = (await fetchJson('/x').catch((x: unknown) => x)) as HttpError
    expect(e.status).toBe(200)
    expect(e.body).toBeNull()
  })
  it('lỗi mạng → HttpError(0)', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    const e = (await fetchJson('/x').catch((x: unknown) => x)) as HttpError
    expect(e.status).toBe(0)
    expect(errorText(e)).toBeNull()
  })
  it('huỷ → ném nguyên AbortError', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError')
    }) as typeof fetch
    const e = await fetchJson('/x').catch((x: unknown) => x)
    expect(isAbort(e)).toBe(true)
    expect(e).not.toBeInstanceOf(HttpError)
  })
})
