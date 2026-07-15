import { mulberry32, weightedRandom, randInt, type RNG } from '../rng'
import { WORLDS, WORLD_ORDER, type MockWorld, type MockTalent } from './data/worlds'
import { fallbackTitle, fallbackTraits, fallbackSummary } from '../fallback'
import type {
  ContentItem,
  FateSummary,
  Grade,
  InscriptionEntry,
  PollutionEntry,
  PropertyAllocate,
  Summary,
  SummaryRow,
  TalentInfo,
  TurnResult,
} from '../types'

interface PropState {
  AGE: number
  CHR: number
  INT: number
  STR: number
  MNY: number
  SPR: number
  LIF: number
  TLT: number[]
  EVT: number[]
  HCHR: number
  HINT: number
  HSTR: number
  HMNY: number
  HSPR: number
  HAGE: number
}

const POLLUTION_CAP = 50

export class MockEngine {
  private world: MockWorld = WORLDS['zh-cn']
  private rng: RNG = mulberry32(123456)
  private seed = 123456
  private pendingSeed: number | null = null
  private characterName = '无名氏'
  private props: PropState = this.freshProps()
  private mythCount = 0
  private eventLog: string[] = []
  private triggerCounts: Record<number, number> = {}
  private finalTalents: number[] = []
  private lastSummary: Summary | null = null
  private lastFate: FateSummary | null = null
  private lastPollutionId: string | null = null

  private registry: InscriptionEntry[] = []
  private pollution: PollutionEntry[] = []

  constructor() {
  }

  private freshProps(): PropState {
    return {
      AGE: -1,
      CHR: 0,
      INT: 0,
      STR: 0,
      MNY: 0,
      SPR: 5,
      LIF: 1,
      TLT: [],
      EVT: [],
      HCHR: 0,
      HINT: 0,
      HSTR: 0,
      HMNY: 0,
      HSPR: 5,
      HAGE: 0,
    }
  }

  prepareLife(characterName?: string | null): number {
    const seed = randInt(mulberry32((Date.now() & 0xffffff) ^ (Math.random() * 1e6)), 100000, 999999)
    this.seed = seed
    this.pendingSeed = seed
    this.rng = mulberry32(seed)
    const folder = WORLD_ORDER[seed % 3]
    this.world = WORLDS[folder]
    const pool = this.world.namePool
    const username = characterName?.trim()
    this.characterName = username || pool[Math.floor(Math.random() * pool.length)] || '无名氏'
    return seed
  }

  get worldFolder(): string {
    return this.world.folder
  }
  get worldLabel(): string {
    return this.world.label
  }
  getCharacterName(): string {
    return this.characterName
  }

  talentRandom(poolSize: number, gradeBonus: number, extendTalentId: number | null): TalentInfo[] {
    const all = this.world.talents
    const result: MockTalent[] = []
    const used = new Set<number>()

    if (extendTalentId != null) {
      const t = all.find((x) => x.id === extendTalentId)
      if (t) {
        result.push(t)
        used.add(t.id)
      }
    }

    const weightFor = (g: Grade): number => {
      const base = [100, 10, 1, 0.5][g]
      if (g >= 2) return base * (1 + gradeBonus * 0.1)
      return base
    }

    let guard = 0
    while (result.length < poolSize && guard++ < 500) {
      const candidates = all.filter((t) => !used.has(t.id))
      if (!candidates.length) break
      const picked = weightedRandom(
        candidates.map((t) => [t, weightFor(t.grade)] as [MockTalent, number]),
        this.rng,
      )
      used.add(picked.id)
      result.push(picked)
    }
    return result.map((t) => this.toTalentInfo(t, t.id === extendTalentId))
  }

  private toTalentInfo(t: MockTalent, inherited = false): TalentInfo {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      grade: t.grade,
      exclude: t.exclude,
      status: t.status,
      effect: t.effect,
      inherited,
    }
  }

  exclude(selectedIds: number[], targetId: number): number | null {
    const target = this.world.talents.find((t) => t.id === targetId)
    for (const sid of selectedIds) {
      const s = this.world.talents.find((t) => t.id === sid)
      if (target?.exclude?.includes(sid) || s?.exclude?.includes(targetId)) {
        return sid
      }
    }
    return null
  }

  remake(_talentIds: number[]): Array<{ from: number; to: number }> {
    return []
  }

  getPropertyPoints(basePoints: number, talentIds: number[]): number {
    let pts = basePoints
    for (const id of talentIds) {
      const t = this.world.talents.find((x) => x.id === id)
      if (t?.status) pts += t.status
    }
    return pts
  }

  start(allocation: PropertyAllocate, talentIds: number[]): void {
    this.props = this.freshProps()
    this.props.CHR = allocation.CHR
    this.props.INT = allocation.INT
    this.props.STR = allocation.STR
    this.props.MNY = allocation.MNY
    this.finalTalents = [...talentIds]
    this.props.TLT = [...talentIds]
    this.seed = this.pendingSeed ?? this.seed
    this.pendingSeed = null
    this.rng = mulberry32(this.seed)
    this.mythCount = 0
    this.eventLog = []
    this.triggerCounts = {}
    this.lastPollutionId = null

    for (const id of talentIds) {
      const t = this.world.talents.find((x) => x.id === id)
      if (t && !t.condition && t.effect) this.applyEffect(t.effect)
    }
    this.syncHistory()
  }

  private applyEffect(effect: Record<string, number>): void {
    for (const [k, v] of Object.entries(effect)) {
      if (k === 'LIF') {
        continue
      }
      ;(this.props as any)[k] = ((this.props as any)[k] ?? 0) + v
    }
    this.syncHistory()
  }

  private syncHistory(): void {
    const p = this.props
    p.HCHR = Math.max(p.HCHR, p.CHR)
    p.HINT = Math.max(p.HINT, p.INT)
    p.HSTR = Math.max(p.HSTR, p.STR)
    p.HMNY = Math.max(p.HMNY, p.MNY)
    p.HSPR = Math.max(p.HSPR, p.SPR)
    p.HAGE = Math.max(p.HAGE, p.AGE)
  }

  next(): TurnResult {
    const p = this.props
    p.AGE += 1
    const age = p.AGE
    const content: ContentItem[] = []

    for (const id of this.finalTalents) {
      const t = this.world.talents.find((x) => x.id === id)
      if (!t || !t.condition) continue
      if (this.checkCondition(t.condition, age) && (this.triggerCounts[id] ?? 0) < 1) {
        if (t.effect) this.applyEffect(t.effect)
        this.triggerCounts[id] = (this.triggerCounts[id] ?? 0) + 1
        content.push({ type: 'TLT', name: t.name, description: t.description, grade: t.grade })
      }
    }

    const agePool = this.world.agePool[age] ?? this.world.agePool[Math.min(age, 100)] ?? []
    let eventContent: ContentItem[] = []
    if (agePool.length) {
      const candidates = agePool.map((entry) => this.parseWeighted(entry))
      const eventId = weightedRandom(candidates, this.rng)
      eventContent = this.doEvent(eventId)
    } else {
      this.rng() 
    }

    const mythContent = this.tryMyth(age)

    this.updateLife(age)
    const isEnd = p.LIF < 1 || age >= 100

    const shown = mythContent.length ? mythContent : eventContent
    content.push(...shown)

    this.syncHistory()
    return {
      age,
      content,
      isEnd,
      propertySnapshot: { CHR: p.CHR, INT: p.INT, STR: p.STR, MNY: p.MNY, SPR: p.SPR },
    }
  }

  private parseWeighted(entry: string | number): [number, number] {
    if (typeof entry === 'number') return [entry, 1]
    const [id, w] = entry.split('*')
    return [Number(id), w ? Number(w) : 1]
  }

  private doEvent(eventId: number): ContentItem[] {
    const e = this.world.events[eventId]
    if (!e) return []
    if (e.effect) this.applyEffect(e.effect)
    this.props.EVT.push(eventId)
    if (e.event) this.eventLog.push(e.event)
    return [
      {
        type: 'EVT',
        description: e.event,
        postEvent: e.postEvent,
        grade: e.grade,
      },
    ]
  }

  private checkCondition(cond: string, age: number): boolean {
    const m = cond.match(/AGE\s*(>=|=)\s*(\d+)/)
    if (!m) return true
    const n = Number(m[2])
    return m[1] === '>=' ? age >= n : age === n
  }

  private mythProbability(): number {
    const p = this.props
    let chance = 0.03
    if (p.AGE >= 80) chance += 0.04
    else if (p.AGE >= 60) chance += 0.02
    if ([p.HCHR, p.HINT, p.HSTR, p.HMNY, p.HSPR].some((h) => h >= 10)) chance += 0.02
    const sum = this.computeSum()
    if (sum >= 110) chance += 0.03
    return Math.min(chance, 0.15)
  }

  private tryMyth(age: number): ContentItem[] {
    if (this.rng() > this.mythProbability()) return []
    const rw = { common: 10, uncommon: 5, rare: 2, legendary: 1 }
    const template = weightedRandom(
      this.world.myths.map((m) => [m, rw[m.rarity]] as const),
      this.rng,
    )
    this.mythCount += 1
    if (template.effect) this.applyEffect(template.effect)

    let description = template.fallback
    if (this.pollution.length > 0 && this.rng() < 1.0) {
      const entry = this.pollution[Math.floor(this.rng() * this.pollution.length)]
      this.lastPollutionId = entry.id
      description = `${entry.characterName}的命运在此显现——${template.fallback}`
    }
    void age
    return [{ type: 'myth_event', grade: template.grade, description }]
  }

  private updateLife(age: number): void {
    const p = this.props
    const vitality = p.STR + p.MNY * 0.3 + p.SPR * 0.2
    const threshold = 55 + vitality * 2
    if (age >= threshold) {
      const over = age - threshold
      if (this.rng() < Math.min(0.05 + over * 0.03, 0.9)) {
        p.LIF = 0
      }
    } else {
      this.rng() 
    }
  }

  private computeSum(): number {
    const p = this.props
    return Math.floor((p.HCHR + p.HINT + p.HSTR + p.HMNY + p.HSPR) * 2 + p.HAGE / 2)
  }

  private fateLevel(sum: number, myth: number): FateSummary['fateLevel'] {
    if (sum >= 120 || myth >= 3) return 'S'
    if (sum >= 100 || myth >= 2) return 'A'
    if (sum >= 80 || myth >= 1) return 'B'
    if (sum >= 60) return 'C'
    return 'D'
  }

  getSummary(): Summary {
    const p = this.props
    const sum = this.computeSum()
    const fl = this.fateLevel(sum, this.mythCount)
    const grade = (v: number, lo: number, hi: number): Grade =>
      v >= hi ? 3 : v >= (lo + hi) / 2 ? 2 : v >= lo ? 1 : 0
    const rows: SummaryRow[] = [
      { key: 'HCHR', label: '颜值', value: p.HCHR, grade: grade(p.HCHR, 4, 10), desc: this.rate(p.HCHR) },
      { key: 'HINT', label: '智力', value: p.HINT, grade: grade(p.HINT, 4, 10), desc: this.rate(p.HINT) },
      { key: 'HSTR', label: '体质', value: p.HSTR, grade: grade(p.HSTR, 4, 10), desc: this.rate(p.HSTR) },
      { key: 'HMNY', label: '家境', value: p.HMNY, grade: grade(p.HMNY, 4, 10), desc: this.rate(p.HMNY) },
      { key: 'HSPR', label: '快乐', value: p.HSPR, grade: grade(p.HSPR, 4, 10), desc: this.rate(p.HSPR) },
      { key: 'HAGE', label: '享年', value: p.HAGE, grade: grade(p.HAGE, 40, 90), desc: `${p.HAGE} 岁` },
      { key: 'SUM', label: '综评', value: sum, grade: grade(sum, 60, 110), desc: fl + ' 级' },
    ]
    this.lastSummary = {
      HAGE: p.HAGE,
      HCHR: p.HCHR,
      HINT: p.HINT,
      HSTR: p.HSTR,
      HMNY: p.HMNY,
      HSPR: p.HSPR,
      sum,
      fateLevel: fl,
      mythCount: this.mythCount,
      seed: this.seed,
      characterName: this.characterName,
      rows,
    }
    this.lastFate = {
      seed: this.seed,
      fateLevel: fl,
      mythEventCount: this.mythCount,
      sum,
      HAGE: p.HAGE,
      HCHR: p.HCHR,
      HINT: p.HINT,
      HSTR: p.HSTR,
      HMNY: p.HMNY,
      HSPR: p.HSPR,
      characterName: this.characterName,
      world: this.world.label,
    }
    return this.lastSummary
  }

  private rate(v: number): string {
    if (v >= 10) return '卓绝'
    if (v >= 8) return '出众'
    if (v >= 6) return '优良'
    if (v >= 4) return '寻常'
    if (v >= 1) return '平庸'
    return '匮乏'
  }

  getFateSummary(): FateSummary {
    if (!this.lastFate) this.getSummary()
    return this.lastFate!
  }

  getLifeSummaryText(): string {
    return fallbackSummary(this.getFateSummary())
  }

  inscribe(): InscriptionEntry {
    const f = this.getFateSummary()
    const p = this.props
    const entry: InscriptionEntry = {
      id: `fate_${f.seed}_${Date.now()}`,
      seed: f.seed,
      title: fallbackTitle(f),
      characterName: f.characterName,
      traits: fallbackTraits(f),
      summary: fallbackSummary(f),
      world: this.world.label,
      fateLevel: f.fateLevel,
      sum: f.sum,
      HAGE: f.HAGE,
      mythCount: f.mythEventCount,
      inscribedAt: Date.now(),
      talentIds: [...this.finalTalents],
      propertyPeak: { CHR: p.HCHR, INT: p.HINT, STR: p.HSTR, MNY: p.HMNY, SPR: p.HSPR },
      pollutionSourceId: this.lastPollutionId,
      slotCount: 5,
      slotHolders: [],
    }
    this.registry.push(entry)
    this.pollution.push({
      id: entry.id,
      title: entry.title,
      characterName: entry.characterName,
      world: entry.world,
      traits: entry.traits,
      fateLevel: entry.fateLevel,
      seed: entry.seed,
      summary: entry.summary,
      addedAt: entry.inscribedAt,
    })
    if (this.pollution.length > POLLUTION_CAP) this.pollution.shift()
    return entry
  }

  registryList(): InscriptionEntry[] {
    return [...this.registry]
  }
  pollutionPool(): PollutionEntry[] {
    return [...this.pollution]
  }
}
