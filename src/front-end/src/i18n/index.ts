import zh from './zh-cn'
import en from './en'
import { format } from '../core/utils'

export type LangDict = typeof zh
export type LangKey = keyof LangDict

const DICTS: Record<string, LangDict> = {
  'zh-cn': zh,
  en,
}

let current: LangDict = zh
let currentCode = 'zh-cn'

export function setLanguage(code: string): void {
  current = DICTS[code] ?? zh
  currentCode = DICTS[code] ? code : 'zh-cn'
}

export function getLanguageCode(): string {
  return currentCode
}

export function isEn(): boolean {
  return currentCode.startsWith('en')
}

export const $lang = new Proxy(
  {
    t(key: LangKey, ...args: unknown[]): string {
      const tpl = current[key] ?? (key as string)
      return args.length ? format(tpl, ...args) : tpl
    },
  } as { t: (key: LangKey, ...args: unknown[]) => string } & LangDict,
  {
    get(target, prop: string) {
      if (prop === 't') return target.t
      const dict = current as Record<string, string>
      if (prop in dict) return dict[prop]
      return prop
    },
  },
)

export type Lang = typeof $lang
