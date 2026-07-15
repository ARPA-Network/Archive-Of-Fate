export interface RadarStat {
  label: string
  value: number
}

export interface RadarOpts {
  size?: number
  stats: RadarStat[] 
  centerTopLabel: string
  centerTopValue: number | string
  centerBottomLabel: string
  centerBottomValue: number | string
  color?: string
}

const FONT = "'Departure Mono', 'Fusion Pixel', monospace"

export function buildRadar(opts: RadarOpts): HTMLCanvasElement {
  const size = opts.size ?? 360
  const color = opts.color ?? '#55fffe'
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const canvas = document.createElement('canvas')
  canvas.width = size * dpr
  canvas.height = size * dpr
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  const stats = opts.stats.slice(0, 5)
  const n = stats.length
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.27
  const angleOf = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n

  const maxVal = Math.max(10, ...stats.map((s) => Math.max(0, s.value)))
  const scaleMax = Math.ceil(maxVal / 5) * 5

  ctx.strokeStyle = 'rgba(170,180,196,0.25)'
  ctx.lineWidth = 1
  for (let ring = 1; ring <= 4; ring++) {
    const rr = (R * ring) / 4
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const a = angleOf(i)
      const x = cx + rr * Math.cos(a)
      const y = cy + rr * Math.sin(a)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
  }

  for (let i = 0; i < n; i++) {
    const a = angleOf(i)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a))
    ctx.stroke()
  }

  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const a = angleOf(i)
    const v = Math.max(0, stats[i].value) / scaleMax
    const rr = R * Math.min(v, 1)
    const x = cx + rr * Math.cos(a)
    const y = cy + rr * Math.sin(a)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = hexToRgba(color, 0.22)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.stroke()

  for (let i = 0; i < n; i++) {
    const a = angleOf(i)
    const v = Math.max(0, stats[i].value) / scaleMax
    const rr = R * Math.min(v, 1)
    ctx.beginPath()
    ctx.arc(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 3, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  ctx.textBaseline = 'middle'
  ctx.font = `18px ${FONT}`
  const PAD = 4
  for (let i = 0; i < n; i++) {
    const a = angleOf(i)
    const cos = Math.cos(a)
    const ly = cy + (R + 18) * Math.sin(a)
    const align = Math.abs(cos) < 0.3 ? 'center' : cos > 0 ? 'left' : 'right'
    ctx.textAlign = align as CanvasTextAlign
    let lx = cx + (R + 18) * cos
    const w = ctx.measureText(stats[i].label).width
    if (align === 'left') lx = Math.min(lx, size - PAD - w)
    else if (align === 'right') lx = Math.max(lx, PAD + w)
    else lx = Math.max(PAD + w / 2, Math.min(lx, size - PAD - w / 2))
    ctx.fillStyle = '#aab4c4'
    ctx.fillText(stats[i].label, lx, ly - 11)
    ctx.fillStyle = color
    ctx.fillText(String(stats[i].value), lx, ly + 11)
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#8a93a3'
  ctx.font = `18px ${FONT}`
  ctx.fillText(opts.centerTopLabel, cx, cy - 34)
  ctx.fillStyle = '#ffce45'
  ctx.font = `bold 46px ${FONT}`
  ctx.fillText(String(opts.centerTopValue), cx, cy)
  ctx.fillStyle = '#aab4c4'
  ctx.font = `20px ${FONT}`
  ctx.fillText(`${opts.centerBottomLabel} ${opts.centerBottomValue}`, cx, cy + 34)

  return canvas
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
