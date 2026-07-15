import { h } from '../ui/dom'

let wrap: HTMLElement | null = null

function ensureWrap(layer: HTMLElement): HTMLElement {
  if (!wrap || !wrap.isConnected) {
    wrap = h('div', { class: 'popup-message-wrap' })
    layer.appendChild(wrap)
  }
  return wrap
}

export function showMessage(layer: HTMLElement, text: string, duration = 2400): void {
  const w = ensureWrap(layer)
  const bubble = h('div', { class: 'popup-message', text })
  w.appendChild(bubble)
  setTimeout(() => {
    bubble.style.transition = 'opacity 0.3s'
    bubble.style.opacity = '0'
    setTimeout(() => bubble.remove(), 300)
  }, duration)
}
