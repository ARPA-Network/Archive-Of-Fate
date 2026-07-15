import type { FateSummaryData, PollutionEntry } from '../types'

export interface AIService {
  generateCharacterName(names: string[], initialName: string): string
  generateMythEvent(
    input: {
      worldText: string
      recentEvents: string
      pollutionEntry: PollutionEntry | null
      age: number
      fallback: string
    },
    lang?: string,
  ): string
  generateLifeSummary(fate: FateSummaryData, eventLog: string[], lang?: string): string
  generateTitle(fate: FateSummaryData, lang?: string): string
  generateTraits(fate: FateSummaryData, lang?: string): string[]
}

function isEn(lang?: string): boolean {
  return (lang ?? '').toLowerCase().startsWith('en')
}

export function fallbackTitle(f: FateSummaryData, lang?: string): string {
  if (isEn(lang)) {
    if (f.fateLevel === 'S') return 'Legendary Fate'
    if (f.HINT >= 9) return 'The Sage'
    if (f.HSTR >= 9) return 'The Warrior'
    if (f.HCHR >= 9) return 'The Beauty'
    if (f.HMNY >= 9) return 'The Magnate'
    if (f.HSPR >= 9) return 'The Free Spirit'
    if (f.HAGE >= 80) return 'The Long-lived'
    if (f.sum >= 90) return 'Notable Figure'
    return 'An Ordinary Life'
  }
  if (f.fateLevel === 'S') return '传奇命运'
  if (f.HINT >= 9) return '智慧之人'
  if (f.HSTR >= 9) return '武道强者'
  if (f.HCHR >= 9) return '倾城之貌'
  if (f.HMNY >= 9) return '富甲一方'
  if (f.HSPR >= 9) return '逍遥自在'
  if (f.HAGE >= 80) return '长寿之人'
  if (f.sum >= 90) return '英杰人物'
  return '平凡人生'
}

export function fallbackTraits(f: FateSummaryData, lang?: string): string[] {
  const t: string[] = []
  if (isEn(lang)) {
    if (f.HCHR >= 8) t.push('Stunning')
    if (f.HINT >= 8) t.push('Erudite')
    if (f.HSTR >= 8) t.push('Robust')
    if (f.HMNY >= 8) t.push('Affluent')
    if (f.HSPR >= 8) t.push('Serene')
    if (f.mythEventCount >= 2) t.push("Fortune's Favorite")
    if (f.fateLevel === 'S') t.push('Legendary')
    return t.length ? t.slice(0, 3) : ['Plain yet Real']
  }
  if (f.HCHR >= 8) t.push('风华绝代')
  if (f.HINT >= 8) t.push('才学出众')
  if (f.HSTR >= 8) t.push('体魄强健')
  if (f.HMNY >= 8) t.push('锦衣玉食')
  if (f.HSPR >= 8) t.push('心旷神怡')
  if (f.mythEventCount >= 2) t.push('命运宠儿')
  if (f.fateLevel === 'S') t.push('传奇人生')
  return t.length ? t.slice(0, 3) : ['平凡但真实']
}

export function fallbackSummary(f: FateSummaryData, lang?: string): string {
  const title = fallbackTitle(f, lang)
  if (isEn(lang)) {
    const name = f.characterName || 'This soul'
    const myth = f.mythEventCount > 0 ? ` and ${f.mythEventCount} mythic moments` : ''
    const tail = f.fateLevel === 'S' || f.fateLevel === 'A' ? 'a destiny worthy of memory' : 'plain yet real'
    return `${name} lived to ${f.HAGE} with an overall score of ${f.sum}${myth} — ${tail}.`
  }
  const name = f.characterName || '此人'
  const myth = f.mythEventCount > 0 ? `命运在 ${f.mythEventCount} 个瞬间显露神迹，` : ''
  const tail = f.fateLevel === 'S' || f.fateLevel === 'A' ? '足以被世界铭记' : '平凡而真实'
  return `${name}，享年 ${f.HAGE} 岁。一生${title}，综评 ${f.sum}。${myth}这段命运${tail}。`
}

export class MockAIService implements AIService {
  generateCharacterName(names: string[], initialName: string): string {
    if (names.length === 0) return initialName || '无名氏'
    return names[Math.floor(Math.random() * names.length)]
  }

  generateMythEvent(
    input: { pollutionEntry: PollutionEntry | null; fallback: string },
    lang?: string,
  ): string {
    const { pollutionEntry, fallback } = input
    if (pollutionEntry) {
      return isEn(lang)
        ? `The fate of ${pollutionEntry.characterName} surfaces here — ${fallback}`
        : `${pollutionEntry.characterName}的命运在此显现——${fallback}`
    }
    return fallback
  }

  generateLifeSummary(fate: FateSummaryData, _eventLog: string[], lang?: string): string {
    return fallbackSummary(fate, lang)
  }

  generateTitle(fate: FateSummaryData, lang?: string): string {
    return fallbackTitle(fate, lang)
  }

  generateTraits(fate: FateSummaryData, lang?: string): string[] {
    return fallbackTraits(fate, lang)
  }
}
