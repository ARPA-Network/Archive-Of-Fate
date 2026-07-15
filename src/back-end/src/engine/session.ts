import { PropertyState } from './properties'
import { mulberry32, generateSeed, type RNG } from './rng'
import { DataStore, type WorldData } from './dataLoader'
import { drawTalents, expandReplacements, applyReplacements, doTalents, doTalent, toTalentInfo } from './talents'
import { filterCandidates, doEvent } from './events'
import { weightedRandom } from './rng'
import { tryMyth } from './myth'
import type { AIService } from '../services/aiService'
import type { PollutionService } from '../services/pollution'
import { config } from '../config'
import type {
  ContentItem,
  FateLevel,
  FateSummaryData,
  InscriptionEntry,
  PropertySnapshot,
  ReplacementLog,
  Summary,
  TalentInfo,
  TurnResult,
} from '../types'

const BASE_POINTS = 20
const MAX_LIMIT_EXPANSION = 10

function calcFateLevel(sum: number, myth: number): FateLevel {
  if (sum >= 120 || myth >= 3) return 'S'
  if (sum >= 100 || myth >= 2) return 'A'
  if (sum >= 80 || myth >= 1) return 'B'
  if (sum >= 60) return 'C'
  return 'D'
}

export interface Services {
  dataStore: DataStore 
  dataStoreEn?: DataStore 
  ai: AIService
  pollution: PollutionService 
}

export class GameSession {
  readonly id: string
  lastActive = Date.now()

  private props = new PropertyState()
  private rng: RNG = mulberry32(0)
  private world: WorldData | null = null

  private pendingSeed = 0
  private seed = 0
  private runCount = 0
  private limitExpansion = 0
  private basePoints = BASE_POINTS
  private sprInit = 0
  private characterName = '无名氏'
  private language = 'zh-cn'

  private currentTalentIds: number[] = []
  private finalTalents: number[] = []
  private replacementLogs: ReplacementLog[] = []

  private eventLog: string[] = []
  private triggerCounts: Record<number, number> = {}
  private mythCount = 0
  private lastPollutionId: string | null = null
  private fateLevel: FateLevel = 'D'

  constructor(id: string, private svc: Services) {
    this.id = id
  }

  touch(): void {
    this.lastActive = Date.now()
  }

  prepareLife(opts: { runCount?: number; limitExpansion?: number; language?: string; seed?: number; characterName?: string | null }): {
    seed: number
    world: string
    characterName: string
    talentPool: TalentInfo[]
    totalPoints: number
    propertyLimits: [number, number]
    spendablePoints: number
    overflow: number
    sprInit: number
    talentLuck: number
    capacity: number
    runCount: number
  } {
    this.runCount = Math.max(0, Math.floor(opts.runCount ?? 0))
    this.limitExpansion = Math.min(Math.max(0, Math.floor(opts.limitExpansion ?? 0)), MAX_LIMIT_EXPANSION)
    this.basePoints = BASE_POINTS + this.runCount

    const seed = typeof opts.seed === 'number' && opts.seed > 0 ? Math.floor(opts.seed) : generateSeed()
    this.seed = seed
    this.pendingSeed = seed
    this.rng = mulberry32(seed)

    this.language = opts.language ?? 'zh-cn'
    const isEn = (opts.language ?? '').toLowerCase().startsWith('en')
    const store = isEn && this.svc.dataStoreEn && this.svc.dataStoreEn.available().length > 0
      ? this.svc.dataStoreEn
      : this.svc.dataStore

    let folder: string = config.worldOrder[seed % 3]
    if (!store.has(folder)) {
      const avail = store.available()
      folder = avail[seed % Math.max(1, avail.length)] ?? folder
    }
    this.world = store.get(folder) ?? null
    if (!this.world) throw new Error('NO_WORLD_DATA')

    const username = opts.characterName?.trim()
    this.characterName = username || this.svc.ai.generateCharacterName(this.world.names, this.world.initialName)
    this.currentTalentIds = []
    this.finalTalents = []

    const m = this.capacityModel()
    this.sprInit = m.sprInit
    const poolSize = Math.min(10 + Math.floor(this.runCount / 10), 50)
    const baseGrade = this.runCount > 400 ? Math.floor((this.runCount - 400) / 10) : 0
    const talentPool = drawTalents(this.world, poolSize, baseGrade + m.talentLuck)

    return {
      seed,
      world: this.world.folder,
      characterName: this.characterName,
      talentPool,
      totalPoints: m.totalPoints,
      propertyLimits: this.propertyLimits(),
      spendablePoints: m.spendable,
      overflow: m.overflow,
      sprInit: m.sprInit,
      talentLuck: m.talentLuck,
      capacity: m.capacity,
      runCount: this.runCount,
    }
  }

  private capacityModel(): {
    upper: number; capacity: number; totalPoints: number
    spendable: number; overflow: number; sprInit: number; talentLuck: number
  } {
    const [, upper] = this.propertyLimits()
    const capacity = 4 * upper
    const totalPoints = this.basePoints
    const spendable = Math.min(totalPoints, capacity)
    const overflow = Math.max(0, totalPoints - capacity)
    const sprInit = Math.min(Math.floor(overflow / 2), 20)
    const talentLuck = Math.ceil(overflow / 2)
    return { upper, capacity, totalPoints, spendable, overflow, sprInit, talentLuck }
  }

  selectTalents(talentIds: number[]): {
    finalTalentIds: number[]
    replacementLog: ReplacementLog[]
    totalPoints: number
    propertyLimits: [number, number]
  } {
    this.requireWorld()
    this.currentTalentIds = [...talentIds]
    this.replacementLogs = expandReplacements(this.world!, talentIds)
    this.finalTalents = applyReplacements(talentIds, this.replacementLogs)

    let pts = this.basePoints
    for (const id of this.finalTalents) {
      const t = this.world!.talents.get(id)
      if (t?.status) pts += t.status
    }

    return {
      finalTalentIds: this.finalTalents,
      replacementLog: this.replacementLogs,
      totalPoints: pts,
      propertyLimits: this.propertyLimits(),
    }
  }

  start(allocation: Record<string, number>): Record<string, number> {
    this.requireWorld()
    const world = this.world!
    this.props.restart()
    this.props.setTMS(this.runCount)

    if (this.finalTalents.length === 0 && this.currentTalentIds.length > 0) {
      this.replacementLogs = expandReplacements(world, this.currentTalentIds)
      this.finalTalents = applyReplacements(this.currentTalentIds, this.replacementLogs)
    }

    for (const k of ['CHR', 'INT', 'STR', 'MNY', 'SPR'] as const) {
      if (typeof allocation[k] === 'number') this.props.change(k, allocation[k])
    }
    if (this.sprInit) this.props.change('SPR', this.sprInit)

    this.props.TLT = [...this.finalTalents]
    this.seed = this.pendingSeed || this.seed
    this.props.set('SEED', this.seed)
    this.rng = mulberry32(this.seed)

    this.mythCount = 0
    this.eventLog = []
    this.triggerCounts = {}
    this.lastPollutionId = null

    for (const id of this.finalTalents) {
      const t = world.talents.get(id)
      if (t && !t.condition) {
        doTalent(world, this.props, id)
        this.triggerCounts[id] = (this.triggerCounts[id] ?? 0) + 1
      }
    }

    return {
      CHR: this.props.CHR,
      INT: this.props.INT,
      STR: this.props.STR,
      MNY: this.props.MNY,
      SPR: this.props.SPR,
      AGE: this.props.AGE,
      LIF: this.props.LIF,
      SEED: this.seed,
    }
  }

  replay(opts: {
    seed: number
    runCount?: number
    finalTalentIds: number[]
    allocation: Record<string, number>
    language?: string
    characterName?: string | null
  }): {
    timeline: Array<{ age: number; content: ContentItem[]; propertySnapshot: PropertySnapshot; isEnd: boolean }>
    summary: {
      seed: number; fate_level: FateLevel; myth_count: number; sum: number
      HAGE: number; HCHR: number; HINT: number; HSTR: number; HMNY: number; HSPR: number
      character_name: string; world: string; title: string; traits: string[]
    }
    talents: TalentInfo[]
  } {
    const runCount = Math.max(0, Math.floor(opts.runCount ?? 0))
    this.prepareLife({
      seed: opts.seed,
      runCount,
      limitExpansion: Math.floor(runCount / 10),
      language: opts.language,
      characterName: opts.characterName,
    })
    this.currentTalentIds = [...opts.finalTalentIds]
    this.finalTalents = [...opts.finalTalentIds]
    this.replacementLogs = []
    this.start(opts.allocation)

    const timeline: Array<{ age: number; content: ContentItem[]; propertySnapshot: PropertySnapshot; isEnd: boolean }> = []
    for (let i = 0; i < 600; i++) {
      const t = this.next()
      timeline.push({ age: t.age, content: t.content, propertySnapshot: t.propertySnapshot, isEnd: t.isEnd })
      if (t.isEnd) break
    }

    const sum = this.getSummary()
    const fate = this.getFateSummaryData()
    const talents = opts.finalTalentIds
      .map((id) => this.world!.talents.get(id))
      .filter((t): t is NonNullable<typeof t> => !!t)
      .map(toTalentInfo)
    return {
      timeline,
      summary: {
        seed: sum.seed, fate_level: sum.fateLevel, myth_count: sum.mythCount, sum: sum.sum,
        HAGE: sum.HAGE, HCHR: sum.HCHR, HINT: sum.HINT, HSTR: sum.HSTR, HMNY: sum.HMNY, HSPR: sum.HSPR,
        character_name: sum.characterName, world: fate.world,
        title: this.getTitle(), traits: this.getTraits(),
      },
      talents,
    }
  }

  next(): TurnResult {
    this.requireWorld()
    const world = this.world!
    const props = this.props

    props.change('AGE', 1)
    const age = props.AGE
    const node = world.ages.get(age) ?? { age, events: [], talents: [] }

    const talentContent = doTalents(world, props, [...props.TLT, ...node.talents], this.triggerCounts)

    let eventContent: ContentItem[] = []
    const candidates = filterCandidates(node, world, props)
    if (candidates.length > 0) {
      const eventId = weightedRandom(candidates, this.rng)
      eventContent = doEvent(world, props, eventId)
      for (const c of eventContent) if (c.description) this.eventLog.push(c.description)
    }

    const myth = tryMyth(
      world,
      props,
      this.rng,
      this.eventLog,
      this.svc.pollution,
      this.svc.ai,
      `${this.id}_${age}`,
      this.language,
    )
    if (myth.content.length > 0) this.mythCount++
    if (myth.pollutionId) this.lastPollutionId = myth.pollutionId

    const isEnd = props.LIF < 1 || age >= world.maxAge

    const shown = myth.content.length > 0 ? myth.content : eventContent
    const content = [...talentContent, ...shown]

    if (isEnd) {
      content.push({ type: 'EVT', grade: 0, description: this.endingText(age, props.LIF < 1) })
    }

    return { age, content, isEnd, propertySnapshot: props.snapshot() }
  }

  private endingText(age: number, byDeath: boolean): string {
    const en = this.language.toLowerCase().startsWith('en')
    const name = this.characterName
    if (byDeath) {
      if (en) {
        return age < 50
          ? `At ${age}, the thread of fate snapped — ${name}'s journey ended early.`
          : `${name} passed away at ${age}, the final curtain falling.`
      }
      return age < 50
        ? `${age} 岁这年，命运的丝线骤然断裂，${name} 的人生就此画上句点。`
        : `${name} 于 ${age} 岁离世，一生落幕。`
    }
    return en
      ? `A full life — ${name} passed peacefully at ${age}, the final curtain falling.`
      : `寿数圆满，${name} 于 ${age} 岁安然辞世，一生落幕。`
  }

  getSummary(): Summary {
    const p = this.props
    const sum = p.SUM
    this.fateLevel = calcFateLevel(sum, this.mythCount)
    return {
      HAGE: p.num('HAGE'),
      HCHR: p.num('HCHR'),
      HINT: p.num('HINT'),
      HSTR: p.num('HSTR'),
      HMNY: p.num('HMNY'),
      HSPR: p.num('HSPR'),
      sum,
      fateLevel: this.fateLevel,
      mythCount: this.mythCount,
      seed: this.seed,
      characterName: this.characterName,
    }
  }

  getFateSummaryData(): FateSummaryData {
    const s = this.getSummary()
    return {
      seed: s.seed,
      fateLevel: s.fateLevel,
      mythEventCount: s.mythCount,
      sum: s.sum,
      HAGE: s.HAGE,
      HCHR: s.HCHR,
      HINT: s.HINT,
      HSTR: s.HSTR,
      HMNY: s.HMNY,
      HSPR: s.HSPR,
      characterName: s.characterName,
      world: this.world?.label ?? '现实',
    }
  }

  getLifeSummaryText(): string {
    return this.svc.ai.generateLifeSummary(this.getFateSummaryData(), this.eventLog, this.language)
  }

  getEventLog(): string[] {
    return [...this.eventLog]
  }

  getTitle(): string {
    return this.svc.ai.generateTitle(this.getFateSummaryData(), this.language)
  }

  getTraits(): string[] {
    return this.svc.ai.generateTraits(this.getFateSummaryData(), this.language)
  }

  inscribe(): InscriptionEntry {
    this.requireWorld()
    const fate = this.getFateSummaryData()
    const p = this.props
    const entry: InscriptionEntry = {
      id: `fate_${fate.seed}_${Date.now()}`,
      seed: fate.seed,
      title: this.getTitle(),
      characterName: fate.characterName,
      traits: this.getTraits(),
      summary: this.getLifeSummaryText(),
      world: this.world!.label,
      fateLevel: fate.fateLevel,
      sum: fate.sum,
      HAGE: fate.HAGE,
      mythCount: fate.mythEventCount,
      inscribedAt: Date.now(),
      talentIds: [...this.finalTalents],
      propertyPeak: {
        CHR: p.num('HCHR'),
        INT: p.num('HINT'),
        STR: p.num('HSTR'),
        MNY: p.num('HMNY'),
        SPR: p.num('HSPR'),
      },
      pollutionSourceId: this.lastPollutionId,
      slotCount: 5,
      slotHolders: [],
    }
    return entry
  }

  private propertyLimits(): [number, number] {
    return [0 - this.limitExpansion, 10 + this.limitExpansion]
  }

  private requireWorld(): void {
    if (!this.world) throw new Error('SESSION_NOT_PREPARED')
  }
}
