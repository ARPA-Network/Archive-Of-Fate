
export function format(template: string, ...args: unknown[]): string {
  return template.replace(/\{(\d+)\}/g, (m, i) => {
    const v = args[Number(i)]
    return v === undefined ? m : String(v)
  })
}

export function clone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (typeof structuredClone === 'function') return structuredClone(obj)
  return JSON.parse(JSON.stringify(obj)) as T
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function shortAddress(addr: string, head = 4, tail = 4): string {
  if (!addr) return ''
  if (addr.length <= head + tail + 2) return addr
  return `${addr.slice(0, head + 2)}...${addr.slice(-tail)}`
}

export function deepMapSet(obj: Record<string, any>, path: string, value: unknown): void {
  const keys = path.split('.')
  let cur = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}
    cur = cur[k]
  }
  cur[keys[keys.length - 1]] = value
}

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function formatDate(ts: number, locale = 'zh-CN'): string {
  try {
    return new Date(ts).toLocaleDateString(locale)
  } catch {
    return ''
  }
}

export const $_ = {
  format,
  clone,
  clamp,
  shortAddress,
  deepMapSet,
  delay,
  formatDate,
}

export type Utils = typeof $_
