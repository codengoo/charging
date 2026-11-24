/**
 * Nhập bằng giọng nói qua Web Speech API (`SpeechRecognition`, Chrome / Edge / Safari dùng tiền tố
 * webkit). Nhận dạng do trình duyệt làm (Chrome gửi âm thanh lên máy chủ Google) — app không gửi gì
 * đi. Firefox chưa có → `speechSupported` false, nơi dùng ẩn nút micro.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { LANG } from '../i18n'

/** Phần tối thiểu của SpeechRecognition dùng ở đây (lib.dom của TS chưa chắc có kiểu này). */
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

/** Lấy lúc dùng (không chốt lúc nạp module) — thử nghiệm thay được bằng bản giả. */
function getCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const speechSupported = getCtor() !== undefined

/** Lỗi đáng báo cho người dùng; còn lại (không nói gì, bấm dừng) thì im lặng. */
export type SpeechError = 'denied' | 'failed'

/**
 * `onText(text, final)`: gọi liên tục trong lúc nói (final = false) và một lần khi chốt câu.
 * Bấm `toggle` lần nữa để dừng sớm.
 */
export function useSpeech(onText: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<SpeechError | null>(null)
  const rec = useRef<Recognition | null>(null)
  const cb = useRef(onText)
  cb.current = onText

  useEffect(() => () => rec.current?.abort(), [])

  const toggle = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) return
    if (rec.current) {
      rec.current.stop()
      return
    }
    const r = new Ctor()
    r.lang = LANG === 'en' ? 'en-US' : 'vi-VN'
    r.interimResults = true
    r.continuous = false
    r.maxAlternatives = 1
    r.onresult = (e) => {
      let text = ''
      let final = false
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0]?.transcript ?? ''
        if (e.results[i].isFinal) final = true
      }
      cb.current(text.trim(), final)
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('denied')
      else if (e.error !== 'no-speech' && e.error !== 'aborted') setError('failed')
    }
    r.onend = () => {
      rec.current = null
      setListening(false)
    }
    setError(null)
    try {
      r.start()
      rec.current = r
      setListening(true)
    } catch {
      setError('failed')
    }
  }, [])

  return { listening, error, toggle, clearError: () => setError(null) }
}
