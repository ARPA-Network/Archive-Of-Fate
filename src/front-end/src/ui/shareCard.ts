import { LEVEL_COLORS, worldDisplayName } from '../core/enums'
import { $lang, isEn } from '../i18n'
import type { FateSummary } from '../core/types'

const CARD_FONT = "'Departure Mono', 'Fusion Pixel', monospace"

export interface CardData {
  fate: FateSummary
  title: string
  traits: string[]
  summary: string
}

const W = 1080
const H = 1920

export function renderFateCard(data: CardData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const { fate, title, traits } = data
  const levelColor = LEVEL_COLORS[fate.fateLevel] ?? '#ffffff'

  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0b1322')
  bg.addColorStop(0.6, '#05070d')
  bg.addColorStop(1, '#020306')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = levelColor
  ctx.lineWidth = 6
  ctx.strokeRect(40, 40, W - 80, H - 80)

  ctx.textAlign = 'center'
  const en = isEn()

  ctx.fillStyle = '#ffce45'
  ctx.font = `bold 56px ${CARD_FONT}`
  ctx.fillText($lang.card_app, W / 2, 160)

  ctx.fillStyle = levelColor
  ctx.font = `bold 360px ${CARD_FONT}`
  ctx.fillText(fate.fateLevel, W / 2, 620)

  ctx.fillStyle = '#ffffff'
  const name = fate.characterName ? `${fate.characterName} · ${title}` : title
  fitFont(ctx, name, W - 120, 64, 32)
  ctx.fillText(name, W / 2, 760)

  ctx.fillStyle = '#55fffe'
  const traitStr = traits.join(' · ')
  fitFont(ctx, traitStr, W - 120, 44, 26)
  ctx.fillText(traitStr, W / 2, 850)

  ctx.fillStyle = '#aab4c4'
  ctx.font = `48px ${CARD_FONT}`
  const lines = [
    $lang.t('card_world', worldDisplayName(fate.world, en)),
    $lang.t('card_score', fate.sum),
    $lang.t('card_age', fate.HAGE),
    fate.mythEventCount > 0 ? $lang.t('card_myth', fate.mythEventCount) : '',
    $lang.t('card_seed', fate.seed),
  ].filter(Boolean)
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 1050 + i * 90))

  if (data.summary && data.summary.trim()) {
    ctx.fillStyle = '#cdd6e4'
    ctx.font = `40px ${CARD_FONT}`
    const wrapped = wrapText(ctx, data.summary.trim(), W - 200, 5)
    const lh = 56
    const startY = 1490
    wrapped.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lh))
  }

  ctx.fillStyle = '#888888'
  ctx.font = `40px ${CARD_FONT}`
  ctx.fillText($lang.card_slogan, W / 2, H - 120)

  return canvas
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const tokens = text.includes(' ') ? text.split(/(\s+)/) : Array.from(text)
  const lines: string[] = []
  let line = ''
  for (const tk of tokens) {
    const test = line + tk
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line.trimEnd())
      line = tk.trimStart()
      if (lines.length >= maxLines) break
    } else {
      line = test
    }
  }
  if (line && lines.length < maxLines) lines.push(line.trimEnd())
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1]
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1)
    if (tokens.length && lines.join('').length < text.length) lines[maxLines - 1] = last + '…'
  }
  return lines
}

export function downloadCard(data: CardData): void {
  const canvas = renderFateCard(data)
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fate_${data.fate.seed}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number, minPx: number): void {
  let px = startPx
  ctx.font = `${px}px ${CARD_FONT}`
  while (px > minPx && ctx.measureText(text).width > maxWidth) {
    px -= 2
    ctx.font = `${px}px ${CARD_FONT}`
  }
}
