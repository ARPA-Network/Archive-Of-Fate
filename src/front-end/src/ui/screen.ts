import { h } from './dom'
import { progression } from '../core/progression'
import { shortAddress } from '../core/utils'
import { $lang } from '../i18n'

export interface ChromeOpts {
  decoBars?: boolean
  sideDeco?: boolean
  hud?: boolean
  gif?: boolean
  gifSrc?: string
  bg?: string
}

const A = (p: string) => `/assets/${p}`

export function buildScreen(root: HTMLElement, opts: ChromeOpts = {}): HTMLElement {
  const safe = h('div', { class: 'safe' })

  if (opts.bg) {
    const bgClass = 'page-bg ' + opts.bg.replace(/\.[^.]+$/, '')
    safe.append(h('img', { class: bgClass, attrs: { src: A(opts.bg), alt: '' } }))
  }

  if (opts.decoBars) {
    safe.append(
      h('img', { class: 'deco-bar top', attrs: { src: A('deco-top.svg'), alt: '' } }),
      h('img', { class: 'deco-bar bottom', attrs: { src: A('deco-bottom.svg'), alt: '' } }),
    )
  }
  if (opts.sideDeco) {
    safe.append(
      h('div', { class: 'side-deco left' }, [h('img', { attrs: { src: A('side-deco-left.svg'), alt: '' } })]),
      h('div', { class: 'side-deco right' }, [h('img', { attrs: { src: A('side-deco-right.svg'), alt: '' } })]),
    )
  }
  if (opts.gif && progression.isWalletConnected()) {
    safe.append(h('img', { class: 'deco-gif', attrs: { src: A(opts.gifSrc ?? 'deco-gif.gif'), alt: '' } }))
  }
  if (opts.hud) {
    const connected = progression.isWalletConnected()
    const addr = connected ? shortAddress(progression.walletAddress() ?? '') : $lang.guest
    const mode = connected ? $lang.mode_advanced : $lang.mode_normal
    safe.append(
      h('div', { class: 'hud addr', text: addr }),
      h('div', { class: 'hud mode', text: mode }),
    )
  }

  root.appendChild(safe)
  return safe
}

export { A as asset }
