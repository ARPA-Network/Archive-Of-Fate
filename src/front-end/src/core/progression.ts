import type { InscriptionEntry, PlayerProgression } from './types'

const KEY_PROG = 'player_progression'
const KEY_INSCRIPTIONS = 'local_inscriptions'
const KEY_TIMES = 'aof_times'
const KEY_THEME = 'theme'
const KEY_LANG = 'aof_lang'
const KEY_PLAYER_ID = 'aof_player_id'
const KEY_ACHV = 'aof_achievements' 
const KEY_WALLET = 'aof_wallet' 
const KEY_USERNAME = 'aof_username' 
const KEY_ANON_TIMES = 'aof_anon_times' 

const BASE_POINTS = 20
const BASE_LIMIT: [number, number] = [0, 10]
const MAX_LIMIT_EXPANSION = 10 

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('[progression] write failed', key, e)
  }
}

function detectBrowserLanguage(): string {
  try {
    const langs = [navigator.language, ...(navigator.languages ?? [])]
    for (const l of langs) {
      if (l?.toLowerCase().startsWith('zh')) return 'zh-cn'
      if (l?.toLowerCase().startsWith('en')) return 'en'
    }
  } catch {
    return 'en'
  }
  return 'en'
}

export const progression = {
  playerId(): string {
    let id = read<string | null>(KEY_PLAYER_ID, null)
    if (!id) {
      id = 'anon_' + Math.random().toString(36).slice(2, 10)
      write(KEY_PLAYER_ID, id)
    }
    return id
  },

  get times(): number {
    return read<number>(KEY_TIMES, 0)
  },
  set times(v: number) {
    write(KEY_TIMES, v)
    const p = this.progression()
    p.runCount = v
    this.saveProgression(p)
  },

  progression(): PlayerProgression {
    const runCount = this.isWalletConnected() ? read<number>(KEY_TIMES, 0) : 0
    return {
      runCount,
      bonusPoints: runCount, 
      limitExpansion: Math.min(Math.floor(runCount / 10), MAX_LIMIT_EXPANSION),
      talentPoolSize: Math.min(10 + Math.floor(runCount / 10), 50),
      talentGradeBonus: runCount > 400 ? Math.floor((runCount - 400) / 10) : 0,
    }
  },

  saveProgression(p: PlayerProgression): void {
    write(KEY_PROG, p)
  },

  totalPoints(): number {
    return BASE_POINTS + this.progression().bonusPoints
  },

  propertyLimits(): [number, number] {
    const exp = this.progression().limitExpansion
    return [BASE_LIMIT[0] - exp, BASE_LIMIT[1] + exp]
  },

  allocModel(): { total: number; capacity: number; spendable: number; overflow: number; sprInit: number; talentLuck: number } {
    const total = this.totalPoints()
    const upper = this.propertyLimits()[1]
    const capacity = 4 * upper
    const spendable = Math.min(total, capacity)
    const overflow = Math.max(0, total - capacity)
    const sprInit = Math.min(Math.floor(overflow / 2), 20)
    const talentLuck = Math.ceil(overflow / 2)
    return { total, capacity, spendable, overflow, sprInit, talentLuck }
  },

  inscriptions(): InscriptionEntry[] {
    return read<InscriptionEntry[]>(KEY_INSCRIPTIONS, [])
  },
  addInscription(entry: InscriptionEntry): void {
    const list = this.inscriptions()
    list.push(entry)
    write(KEY_INSCRIPTIONS, list)
  },

  achievements(): Array<[number, number]> {
    return read<Array<[number, number]>>(KEY_ACHV, [])
  },
  unlockAchievement(id: number, ts: number): boolean {
    const list = this.achievements()
    if (list.some(([aid]) => aid === id)) return false
    list.push([id, ts])
    write(KEY_ACHV, list)
    return true
  },

  walletAddress(): string | null {
    return read<string | null>(KEY_WALLET, null)
  },
  isWalletConnected(): boolean {
    return !!this.walletAddress()
  },
  connectWallet(address?: string): string {
    const addr = address || '0x' + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10)
    write(KEY_WALLET, addr)
    return addr
  },
  disconnectWallet(): void {
    try {
      localStorage.removeItem(KEY_WALLET)
    } catch {
    }
  },

  anonTimes(): number {
    return read<number>(KEY_ANON_TIMES, 0)
  },
  bumpAnonTimes(): void {
    write(KEY_ANON_TIMES, this.anonTimes() + 1)
  },

  username(): string {
    return read<string>(KEY_USERNAME, '')
  },
  setUsername(name: string): void {
    const v = (name || '').trim().slice(0, 12)
    if (v) write(KEY_USERNAME, v)
    else {
      try { localStorage.removeItem(KEY_USERNAME) } catch {  }
    }
  },

  theme(): string {
    return read<string>(KEY_THEME, 'default')
  },
  setTheme(t: string): void {
    write(KEY_THEME, t)
  },
  lang(): string {
    const raw = localStorage.getItem(KEY_LANG)
    if (raw != null) {
      try {
        return JSON.parse(raw) as string
      } catch {
      }
    }
    const detected = detectBrowserLanguage()
    write(KEY_LANG, detected)
    return detected
  },
  setLang(l: string): void {
    write(KEY_LANG, l)
  },

  exportSave(): string {
    const dump: Record<string, unknown> = {}
    for (const k of [KEY_PROG, KEY_INSCRIPTIONS, KEY_TIMES, KEY_ANON_TIMES, KEY_ACHV, KEY_PLAYER_ID, KEY_WALLET, KEY_USERNAME]) {
      const raw = localStorage.getItem(k)
      if (raw != null) dump[k] = JSON.parse(raw)
    }
    return JSON.stringify({ __aof_save__: 1, data: dump }, null, 2)
  },
  importSave(json: string): boolean {
    try {
      const parsed = JSON.parse(json)
      const data = parsed.__aof_save__ ? parsed.data : parsed
      for (const [k, v] of Object.entries(data)) {
        localStorage.setItem(k, JSON.stringify(v))
      }
      return true
    } catch (e) {
      console.error('[progression] import failed', e)
      return false
    }
  },
}
