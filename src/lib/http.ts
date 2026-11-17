/**
 * fetch JSON một kiểu cho mọi module client: lỗi mạng và mã lỗi HTTP đều thành `HttpError`
 * (status 0 = không tới được server), huỷ (AbortController) thì ném nguyên AbortError để
 * caller bỏ qua. Mỗi module tự đổi `HttpError` thành câu báo của mình.
 */

export class HttpError extends Error {
  constructor(
    /** Mã HTTP; 0 = lỗi mạng (fetch ném). */
    readonly status: number,
    /** Body JSON của phản hồi lỗi (vd. `{ error }` của Worker); null nếu không đọc được. */
    readonly body: unknown = null,
    options?: { cause?: unknown },
  ) {
    super(status ? `HTTP ${status}` : 'network', options)
  }
}

export function isAbort(e: unknown): boolean {
  return (e as { name?: string } | null)?.name === 'AbortError'
}

/** `error` trong body lỗi của Worker (`{ error: "…" }`), nếu có. */
export function errorText(e: unknown): string | null {
  const b = e instanceof HttpError ? (e.body as { error?: unknown } | null) : null
  return typeof b?.error === 'string' ? b.error : null
}

/** 204 → undefined. Body 2xx không phải JSON → HttpError(status). */
export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch (e) {
    if (isAbort(e) || init?.signal?.aborted) throw e
    throw new HttpError(0, null, { cause: e })
  }
  if (res.status === 204) return undefined as T
  const body = (await res.json().catch(() => undefined)) as unknown
  if (!res.ok || body === undefined) throw new HttpError(res.status, body ?? null)
  return body as T
}
