import QRCode from 'qrcode'

/**
 * QR chia sẻ — cùng cách làm với chiatien (`src/lib/qr-image.ts`):
 * - Trên màn hình chỉ hiện mã QR TRƠN trên ô trắng (camera quét dễ, nhìn gọn).
 * - Ảnh thẻ (tiêu đề + mã + chú thích) chỉ dựng lúc tải về / chia sẻ file.
 */

/** Cạnh mã QR khi vẽ, px thật — vẽ to cho nét trên retina và ảnh tải về, hiển thị nhỏ lại bằng CSS. */
export const QR_PX = 480

/** Vẽ mã QR (không lề, nền trắng) vào canvas có sẵn. */
export function drawQr(canvas: HTMLCanvasElement, url: string): Promise<void> {
  return QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: QR_PX,
    color: { dark: '#0a0a0a', light: '#ffffff' },
  })
}

const TITLE_FONT = "'Bricolage Grotesque Variable', 'Be Vietnam Pro', system-ui, sans-serif"
const BODY_FONT = "'Be Vietnam Pro', system-ui, sans-serif"

/** Ảnh PNG nền trắng: tiêu đề, mã QR, các dòng chú thích. Dùng để tải về / gửi qua app khác. */
export async function renderQrCard(qr: HTMLCanvasElement, title: string, lines: string[], color = '#009966'): Promise<Blob> {
  await document.fonts?.ready
  const size = qr.width
  const pad = 48
  const width = size + pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = pad + 70 + size + 30 + lines.length * 38 + pad
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.textAlign = 'center'
  ctx.fillStyle = color
  ctx.font = `700 34px ${TITLE_FONT}`
  ctx.fillText(fitText(ctx, title, width - pad * 2), width / 2, pad + 30)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(qr, pad, pad + 70, size, size)
  ctx.fillStyle = '#404040'
  ctx.font = `400 24px ${BODY_FONT}`
  lines.forEach((line, i) => ctx.fillText(fitText(ctx, line, width - pad * 2), width / 2, pad + 70 + size + 50 + i * 38))
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh QR'))), 'image/png'),
  )
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text
  let s = text
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1)
  return `${s}…`
}
