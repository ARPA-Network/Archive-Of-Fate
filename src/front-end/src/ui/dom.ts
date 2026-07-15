
export type El = HTMLElement

interface ElProps {
  class?: string
  text?: string
  html?: string
  id?: string
  style?: Partial<CSSStyleDeclaration> & Record<string, string>
  onClick?: (e: MouseEvent) => void
  attrs?: Record<string, string>
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  children: (El | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (props.class) el.className = props.class
  if (props.id) el.id = props.id
  if (props.text != null) el.textContent = props.text
  if (props.html != null) el.innerHTML = props.html
  if (props.style) Object.assign(el.style, props.style)
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v)
  if (props.onClick) el.addEventListener('click', props.onClick as EventListener)
  for (const c of children) {
    el.append(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return el
}

export function button(
  label: string,
  onClick: (e: MouseEvent) => void,
  cls = '',
): HTMLButtonElement {
  return h('button', { class: `btn ${cls}`.trim(), text: label, onClick })
}

export function setText(el: El | null, text: string): void {
  if (el) el.textContent = text
}

export function setColor(el: El | null, color: string): void {
  if (el) el.style.color = color
}

export function clear(el: El): void {
  while (el.firstChild) el.removeChild(el.firstChild)
}
