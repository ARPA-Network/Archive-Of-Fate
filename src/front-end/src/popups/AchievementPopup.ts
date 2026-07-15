import { h } from '../ui/dom'
import { GRADE_COLORS } from '../core/enums'
import { $lang } from '../i18n'
import type { Grade } from '../core/types'

let wrap: HTMLElement | null = null

function ensureWrap(layer: HTMLElement): HTMLElement {
  if (!wrap || !wrap.isConnected) {
    wrap = h('div', { class: 'popup-achv-wrap' })
    layer.appendChild(wrap)
  }
  return wrap
}

export function showAchievementPopup(
  layer: HTMLElement,
  data: { name: string; grade: number },
): void {
  const w = ensureWrap(layer)
  const color = GRADE_COLORS[(data.grade as Grade) ?? 0]
  const el = h('div', {
    class: 'popup-achv',
    text: $lang.t('achv_unlocked', data.name),
    style: { color, borderColor: color },
  })
  w.appendChild(el)
  setTimeout(() => {
    el.style.transition = 'opacity 0.3s'
    el.style.opacity = '0'
    setTimeout(() => el.remove(), 300)
  }, 3000)
}
