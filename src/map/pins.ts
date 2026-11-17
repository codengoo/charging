/**
 * Ghim trạm trên bản đồ. Port từ ic_pin_shell / ic_pin_disc / ic_grp_* + pinBitmap()
 * của charge-map-android.
 *
 * Ghim có ba lớp chồng nhau trên cùng một khung 112×118 (tâm đầu ghim ở (56,56), mũi ghim
 * chạm đáy khung):
 *   1. vỏ giọt nước TRẮNG, viền xám nhạt — không có viền thì vỏ trắng tan vào đường/nhà;
 *   2. đĩa tròn màu NHẠT (màu nhóm trộn với trắng);
 *   3. hình trong lòng màu ĐẬM (cùng sắc, giảm độ sáng).
 *
 * MapLibre chỉ đổi màu được ảnh SDF, mà SDF làm nhoè nét mảnh — nên nhuộm sẵn từng biến thể
 * thành ảnh riêng, đúng cách app Android làm.
 */
import type { GroupIconKey } from '../data/groups'

export type PinGlyph = GroupIconKey | 'charger'

const FRAME_W = 112
const FRAME_H = 118

const SHELL =
  'M56,8 C29.5,8 8,29.5 8,56 C8,74.5 18.4,90.1 32.5,102.8 L43.7,113.2 ' +
  'C50.7,119.6 61.3,119.6 68.3,113.2 L79.5,102.8 C93.6,90.1 104,74.5 104,56 ' +
  'C104,29.5 82.5,8 56,8 Z'

/** Bộ Material Icons khung 24×24, đều canh quanh (12,12) — dùng chung một phép biến đổi. */
const GRP_TRANSFORM = 'translate(28.52 28.52) scale(2.29)'

interface GlyphDef {
  d: string
  transform: string
  evenOdd?: boolean
}

const GLYPHS: Record<PinGlyph, GlyphDef> = {
  // Phích cắm điện có tia sét khoét rỗng — hình mặc định của ghim trạm. Hình trụ bơm cũ trông
  // như cây xăng. evenOdd để tia sét là LỖ, lộ màu đĩa nhạt phía dưới.
  charger: {
    d: 'M16.01,7 L16,3 h-2 v4 h-4 V3 H8 v4 h-0.01 C7,6.99 6,7.99 6,8.99 v5.49 L9.5,18 v3 h5 v-3 l3.5,-3.51 v-5.5 c0,-1 -1,-2 -1.99,-1.99 Z M12.9,8.4 L9.9,12.6 h1.9 L11.1,16 L14.1,11.8 h-1.9 Z',
    transform: GRP_TRANSFORM,
    evenOdd: true,
  },
  heart: {
    d: 'M12,21.35l-1.45,-1.32C5.4,15.36 2,12.28 2,8.5 2,5.42 4.42,3 7.5,3c1.74,0 3.41,0.81 4.5,2.09C13.09,3.81 14.76,3 16.5,3 19.58,3 22,5.42 22,8.5c0,3.78 -3.4,6.86 -8.55,11.54L12,21.35z',
    transform: GRP_TRANSFORM,
  },
  star: {
    d: 'M12,17.27L18.18,21l-1.64,-7.03L22,9.24l-7.19,-0.61L12,2 9.19,8.63 2,9.24l5.46,4.73L5.82,21z',
    transform: GRP_TRANSFORM,
  },
  flag: { d: 'M14.4,6L14,4L5,4v17h2v-7h5.6l0.4,2h7L14.4,6z', transform: GRP_TRANSFORM },
  bookmark: {
    d: 'M17,3H7c-1.1,0 -1.99,0.9 -1.99,2L5,21l7,-3 7,3V5c0,-1.1 -0.9,-2 -2,-2z',
    transform: GRP_TRANSFORM,
  },
  bolt: {
    d: 'M11,21h-1l1,-7H7.5c-0.58,0 -0.57,-0.32 -0.38,-0.66 0.19,-0.34 0.05,-0.08 0.07,-0.12C8.48,10.94 10.42,7.54 13,3h1l-1,7h3.5c0.49,0 0.56,0.33 0.47,0.51l-0.07,0.15C12.96,17.55 11,21 11,21z',
    transform: GRP_TRANSFORM,
  },
  place: {
    d: 'M12,2c-4.2,0 -8,3.22 -8,8.2 0,3.32 2.67,7.25 8,11.8 5.33,-4.55 8,-8.48 8,-11.8C20,5.22 16.2,2 12,2zM12,12c-1.1,0 -2,-0.9 -2,-2s0.9,-2 2,-2 2,0.9 2,2 -0.9,2 -2,2z',
    transform: GRP_TRANSFORM,
  },
  home: { d: 'M10,20v-6h4v6h5v-8h3L12,3 2,12h3v8z', transform: GRP_TRANSFORM },
  work: {
    d: 'M20,6h-4V4c0,-1.11 -0.89,-2 -2,-2h-4c-1.11,0 -2,0.89 -2,2v2H4c-1.11,0 -1.99,0.89 -1.99,2L2,19c0,1.11 0.89,2 2,2h16c1.11,0 2,-0.89 2,-2V8c0,-1.11 -0.89,-2 -2,-2zM14,6h-4V4h4v2z',
    transform: GRP_TRANSFORM,
  },
  cart: {
    d: 'M7,18c-1.1,0 -1.99,0.9 -1.99,2S5.9,22 7,22s2,-0.9 2,-2 -0.9,-2 -2,-2zM1,2v2h2l3.6,7.59 -1.35,2.45c-0.16,0.28 -0.25,0.61 -0.25,0.96 0,1.1 0.9,2 2,2h12v-2H7.42c-0.14,0 -0.25,-0.11 -0.25,-0.25l0.03,-0.12 0.9,-1.63h7.45c0.75,0 1.41,-0.41 1.75,-1.03l3.58,-6.49C21.25,4.82 20.92,4 20.01,4H5.21l-0.94,-2L1,2zM17,18c-1.1,0 -1.99,0.9 -1.99,2s0.89,2 1.99,2 2,-0.9 2,-2 -0.9,-2 -2,-2z',
    transform: GRP_TRANSFORM,
  },
  coffee: {
    d: 'M20,3H4v10c0,2.21 1.79,4 4,4h6c2.21,0 4,-1.79 4,-4v-3h2c1.11,0 2,-0.9 2,-2V5c0,-1.11 -0.89,-2 -2,-2zM20,8h-2V5h2v3zM4,19h16v2H4z',
    transform: GRP_TRANSFORM,
  },
  bed: {
    d: 'M7,13c1.66,0 3,-1.34 3,-3S8.66,7 7,7s-3,1.34 -3,3 1.34,3 3,3zM19,7h-8v7H3V5H1v15h2v-3h18v3h2v-9c0,-2.21 -1.79,-4 -4,-4z',
    transform: GRP_TRANSFORM,
  },
}

/** Tia sét của trạm ĐANG CHỌN — khung riêng, to hơn hình nhóm một chút. */
const SELECTED_BOLT: GlyphDef = { d: GLYPHS.bolt.d, transform: 'translate(26 26.12) scale(2.49)' }

// ------------------------------------------------------------ màu

function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const n = m ? parseInt(m[1], 16) : 0x64748b
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')
}

/**
 * Bản ĐẶC của "màu này ở độ mờ `amount`" — trộn sẵn với trắng. Trên bản đồ nền là ảnh,
 * màu trong suốt sẽ ăn theo đường sá bên dưới và mỗi chỗ một kiểu.
 */
export function tintHex(hex: string, amount = 0.24): string {
  return toHex(parseHex(hex).map((c) => 255 - (255 - c) * amount) as [number, number, number])
}

/** Cùng sắc nhưng tối hơn: nhân thẳng ba kênh, không trộn đen (trộn đen làm xám đi). */
export function darkenHex(hex: string, factor = 0.62): string {
  return toHex(parseHex(hex).map((c) => c * factor) as [number, number, number])
}

// ------------------------------------------------------------ SVG

export interface PinSpec {
  colorHex: string
  glyph: PinGlyph | 'selected'
  /** Bóng mờ dưới ghim. Tắt cho icon nhỏ trong danh sách. */
  shadow?: boolean
}

/** Lề trên/trái/phải để bóng không bị cắt. */
const PAD = 6
/**
 * Lề đáy: viền vỏ (stroke 2.5) và bóng ở mũi ghim tràn quá đáy khung 112×118 — không có lề
 * này thì mũi ghim bị cắt cụt. Trên bản đồ bù lại bằng [pinTipOffset] để mũi vẫn cắm
 * đúng toạ độ.
 */
const PAD_BOTTOM = 8

/** SVG hoàn chỉnh của một ghim; `width` px, cao theo tỉ lệ khung. */
export function pinSvg({ colorHex, glyph, shadow = true }: PinSpec, width: number): string {
  const g = glyph === 'selected' ? SELECTED_BOLT : GLYPHS[glyph]
  const vbW = FRAME_W + PAD * 2
  const vbH = FRAME_H + PAD + PAD_BOTTOM
  const height = (width * vbH) / vbW
  const filter = shadow
    ? `<filter id="s" x="-20%" y="-20%" width="140%" height="140%">` +
      `<feDropShadow dx="0" dy="3.5" stdDeviation="3.2" flood-color="#000" flood-opacity="0.28"/></filter>`
    : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="${-PAD} ${-PAD} ${vbW} ${vbH}">` +
    `<defs>${filter}</defs>` +
    `<path d="${SHELL}" fill="#fff" stroke="#D9DDE1" stroke-width="2.5" stroke-linejoin="round"` +
    `${shadow ? ' filter="url(#s)"' : ''}/>` +
    `<circle cx="56" cy="56" r="35" fill="${tintHex(colorHex)}"/>` +
    `<g transform="${g.transform}"><path d="${g.d}" fill="${darkenHex(colorHex)}"` +
    `${g.evenOdd ? ' fill-rule="evenodd"' : ''}/></g>` +
    `</svg>`
  )
}

/** Hình phích cắm của ghim trạm (khung 24×24, evenodd) — chú giải vẽ lại không cần vỏ ghim. */
export const CHARGER_GLYPH = GLYPHS.charger.d

export function pinDataUrl(spec: PinSpec, width: number): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pinSvg(spec, width))
}

/** Tỉ lệ cao/rộng của ảnh ghim (kể cả lề bóng). */
export const PIN_ASPECT = (FRAME_H + PAD + PAD_BOTTOM) / (FRAME_W + PAD * 2)

/**
 * Khoảng từ đáy ảnh lên mũi ghim, px CSS, cho ghim rộng `cssWidth`. Dùng làm `icon-offset`
 * (dương = dịch xuống) khi neo ảnh theo đáy.
 */
export function pinTipOffset(cssWidth: number): number {
  return (PAD_BOTTOM * cssWidth) / (FRAME_W + PAD * 2)
}

/**
 * Raster hoá ghim thành ImageData để `map.addImage`. Vẽ ở mật độ điểm ảnh của màn hình
 * rồi khai `pixelRatio` cho MapLibre, không thì ghim nhoè trên màn hình retina.
 */
export async function rasterizePin(
  spec: PinSpec,
  cssWidth: number,
  pixelRatio: number,
): Promise<ImageData> {
  const w = Math.round(cssWidth * pixelRatio)
  const h = Math.round(w * PIN_ASPECT)
  const img = new Image(w, h)
  img.src = pinDataUrl(spec, w)
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d không khả dụng')
  ctx.drawImage(img, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

/**
 * Màu ghim thường theo mức công suất (index = PowerTier): AC hoặc chưa rõ / DC < 120 kW /
 * DC ≥ 120 kW. Tránh xanh #2563EB của nhóm "Sẽ đến" để ghim nhóm và ghim mức không lẫn.
 */
export const TIER_COLORS = ['#12B76A', '#0284C7', '#7C3AED'] as const
