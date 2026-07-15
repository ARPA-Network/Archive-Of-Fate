import type { FateSummary } from './types'
import { isEn } from '../i18n'

export function fallbackTitle(f: FateSummary): string {
  const en = isEn()
  if (f.fateLevel === 'S') return en ? 'Legendary Fate' : '传奇命运'
  if (f.HINT >= 9) return en ? 'The Wise' : '智慧之人'
  if (f.HSTR >= 9) return en ? 'Martial Master' : '武道强者'
  if (f.HCHR >= 9) return en ? 'Peerless Beauty' : '倾城之貌'
  if (f.HMNY >= 9) return en ? 'Tycoon' : '富甲一方'
  if (f.HSPR >= 9) return en ? 'The Carefree' : '逍遥自在'
  if (f.HAGE >= 80) return en ? 'Long-Lived' : '长寿之人'
  if (f.sum >= 90) return en ? 'Paragon' : '英杰人物'
  return en ? 'An Ordinary Life' : '平凡人生'
}

export function fallbackTraits(f: FateSummary): string[] {
  const en = isEn()
  const traits: string[] = []
  if (f.HCHR >= 8) traits.push(en ? 'Radiant' : '风华绝代')
  if (f.HINT >= 8) traits.push(en ? 'Brilliant' : '才学出众')
  if (f.HSTR >= 8) traits.push(en ? 'Vigorous' : '体魄强健')
  if (f.HMNY >= 8) traits.push(en ? 'Affluent' : '锦衣玉食')
  if (f.HSPR >= 8) traits.push(en ? 'Serene' : '心旷神怡')
  if (f.mythEventCount >= 2) traits.push(en ? 'Favored by Fate' : '命运宠儿')
  if (f.fateLevel === 'S') traits.push(en ? 'Legendary' : '传奇人生')
  const sliced = traits.slice(0, 3)
  if (sliced.length) return sliced
  return [en ? 'Plain yet real' : '平凡但真实']
}

export function fallbackSummary(f: FateSummary): string {
  const en = isEn()
  const title = fallbackTitle(f)
  if (en) {
    const name = f.characterName || 'This soul'
    const myth = f.mythEventCount > 0 ? `Fate revealed miracles in ${f.mythEventCount} moments. ` : ''
    const tail = f.fateLevel === 'S' || f.fateLevel === 'A' ? 'is worthy of remembrance' : 'was plain but real'
    return `${name}, lived to ${f.HAGE}. A life of ${title}, score ${f.sum}. ${myth}This fate ${tail}.`
  }
  const name = f.characterName || '此人'
  return `${name}，享年 ${f.HAGE} 岁。一生${title}，综评 ${f.sum}。${
    f.mythEventCount > 0 ? `命运在 ${f.mythEventCount} 个瞬间显露神迹，` : ''
  }这段命运${f.fateLevel === 'S' || f.fateLevel === 'A' ? '足以被世界铭记' : '平凡而真实'}。`
}
