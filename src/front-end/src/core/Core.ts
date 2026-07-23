import { MockEngine } from './mock/MockEngine'
import { ApiClient, sendPreparedTx, type GameReadyResp } from './ApiClient'
import { progression } from './progression'
import { $$event } from './eventBus'
import { setLanguage, isEn } from '../i18n'
import { worldDisplayName } from './enums'
import { fallbackTitle, fallbackTraits } from './fallback'
import {
  isInscribeConfigured,
  isSeedConfigured,
  inscribe as chainInscribe,
  connect as chainConnect,
  requestSeed as chainRequestSeed,
} from '../web3/chain'
import type {
  ContentItem,
  FateSummary,
  Grade,
  InscriptionEntry,
  PollutionEntry,
  PropertyAllocate,
  PropTypeMap,
  ReplacementLog,
  Summary,
  SummaryRow,
  TalentInfo,
  TurnResult,
} from './types'

const EXT_KEY = 'aof_ext_talent'
const TALENT_SELECT_LIMIT = 3

const PROPERTY_TYPES: PropTypeMap = {
  CHR: { name: '颜值', color: '#ff9ecd' },
  INT: { name: '智力', color: '#55fffe' },
  STR: { name: '体质', color: '#ff7878' },
  MNY: { name: '家境', color: '#ffce45' },
  SPR: { name: '快乐', color: '#84ff55' },
}

export class Core {
  private engine = new MockEngine()
  private api: ApiClient | null = null
  private useApi = false
  private _times = 0

  private sessionId = ''
  private seed = 0
  private folder = 'zh-cn'
  private worldName = '现实'
  private charName = '无名氏'
  private talentPool: TalentInfo[] = []
  private finalTalentIds: number[] = []
  private replacementLog: ReplacementLog[] = []
  private basePoints = 20
  private cachedTotalPoints = 20
  private cachedLimits: [number, number] = [0, 10]
  private cachedCapacity = 40
  private cachedSprInit = 0
  private cachedTalentLuck = 0
  private pendingAllocation: PropertyAllocate | null = null

  private precomputedTurns: TurnResult[] = []
  private turnIdx = 0

  private cachedSummary: Summary | null = null
  private cachedFate: FateSummary | null = null
  private cachedLifeSummary = ''
  private cachedTitle = ''
  private cachedTraits: string[] = []

  private sharedRegistry: InscriptionEntry[] = []
  private sharedPollution: PollutionEntry[] = []
  private sharedMyRegistry: InscriptionEntry[] = []

  async initial(language: string): Promise<void> {
    setLanguage(language)
    this._times = progression.times
    const base = (import.meta.env.VITE_API_BASE as string | undefined)?.trim()
    if (base) {
      this.api = new ApiClient(base)
      this.useApi = true
      try {
        await this.refreshShared()
        console.info('[core] 后端模式已启用：', base)
      } catch (e) {
        console.warn('[core] 后端连接失败，回退到本地 Mock：', e)
        this.useApi = false
        this.api = null
      }
    } else {
      console.info('[core] 未配置 VITE_API_BASE，使用本地 Mock 引擎')
    }
  }

  async prepareLife(): Promise<number> {
    this.resetSession()
    const guest = !progression.isWalletConnected()
    if (this.useApi && this.api) {
      const wallet = guest ? null : progression.walletAddress()
      const prog = progression.progression()
      const r = await this.api.gameNew({
        language: progression.lang(),
        wallet_address: wallet,
        run_count: wallet ? prog.runCount : progression.anonTimes(),
        username: progression.username() || null,
        player_id: progression.playerId(),
      })
      this.sessionId = r.session_id

      if (r.status === 'awaiting_seed') {
        if (!isSeedConfigured()) throw new Error('缺少随机数合约配置（VITE_CONSUMER_ADDRESS）')
        $$event('loading_status', 'loading_randcast')
        const { seed, requestId, txHash } = await chainRequestSeed(r.seed_cost_bnb ?? '0.0001')
        const ready = await this.api.submitSeed(this.sessionId, {
          request_id: requestId,
          seed,
          request_tx: txHash,
        })
        this.applyReady(ready)
        return this.seed
      }

      if (r.seed_tx) {
        const hash = await sendPreparedTx(r.seed_tx, wallet ?? undefined)
        await this.api.seedSent(this.sessionId, hash).catch(() => {})
      }
      $$event('loading_status', 'loading_seed')
      const ready = await this.pollSeedReady()
      this.applyReady(ready)
      if (guest) progression.bumpAnonTimes()
      return this.seed
    }
    this.seed = this.engine.prepareLife(progression.username() || null)
    this.folder = this.engine.worldFolder
    this.worldName = worldDisplayName(this.folder, isEn())
    this.charName = this.effectiveName(this.engine.getCharacterName())
    if (guest) progression.bumpAnonTimes()
    return this.seed
  }

  private effectiveName(fallback: string): string {
    const u = progression.username()?.trim()
    return u || fallback
  }

  private applyReady(ready: GameReadyResp): void {
    this.seed = ready.seed ?? 0
    this.folder = ready.world ?? 'zh-cn'
    this.worldName = worldDisplayName(this.folder, isEn())
    this.charName = this.effectiveName(ready.character_name ?? '无名氏')
    this.talentPool = (ready.talent_pool as TalentInfo[]) ?? []
    this.basePoints = ready.total_points ?? 20
    this.cachedTotalPoints = this.basePoints
    this.cachedLimits = ready.property_limits ?? [0, 10]
    this.cachedCapacity = ready.capacity ?? 4 * this.cachedLimits[1]
    this.cachedSprInit = ready.spr_init ?? 0
    this.cachedTalentLuck = ready.talent_luck ?? 0
    this.markInheritedTalent()
  }

  allocInfo(): {
    total: number; spendable: number; overflow: number
    sprInit: number; talentLuck: number; capacity: number; limits: [number, number]
  } {
    const total = this.getPropertyPoints()
    let capacity: number, sprInit: number, talentLuck: number, limits: [number, number]
    if (this.useApi) {
      capacity = this.cachedCapacity
      sprInit = this.cachedSprInit
      talentLuck = this.cachedTalentLuck
      limits = this.cachedLimits
    } else {
      const m = progression.allocModel()
      capacity = m.capacity
      sprInit = m.sprInit
      talentLuck = m.talentLuck
      limits = progression.propertyLimits()
    }
    const spendable = Math.min(total, capacity)
    const overflow = Math.max(0, total - capacity)
    return { total, spendable, overflow, sprInit, talentLuck, capacity, limits }
  }

  async replayFate(entry: InscriptionEntry): Promise<{ matched: boolean; sum: number; hage: number; fateLevel: string } | null> {
    if (!this.useApi || !this.api) return null
    const a = entry.allocation ?? { CHR: 0, INT: 0, STR: 0, MNY: 0 }
    const r = await this.api.replay({
      seed: entry.seed,
      talent_ids: entry.talentIds ?? [],
      allocation: { CHR: a.CHR, INT: a.INT, STR: a.STR, MNY: a.MNY },
      run_count: entry.runCount ?? 0,
      language: progression.lang(),
      character_name: entry.characterName,
    })
    const s = r.summary
    const matched = s.fate_level === entry.fateLevel && s.sum === entry.sum && s.HAGE === entry.HAGE
    return { matched, sum: s.sum, hage: s.HAGE, fateLevel: s.fate_level }
  }

  talentRandom(): TalentInfo[] {
    if (this.useApi) return this.talentPool
    const prog = progression.progression()
    this.talentPool = this.engine.talentRandom(prog.talentPoolSize, prog.talentGradeBonus, this.lastExtendTalent)
    return this.talentPool
  }

  exclude(selectedIds: number[], targetId: number): number | null {
    if (this.useApi) {
      const target = this.talentPool.find((t) => t.id === targetId)
      for (const sid of selectedIds) {
        const s = this.talentPool.find((t) => t.id === sid)
        if (target?.exclude?.includes(sid) || s?.exclude?.includes(targetId)) return sid
      }
      return null
    }
    return this.engine.exclude(selectedIds, targetId)
  }

  async selectTalents(talentIds: number[]): Promise<void> {
    if (this.useApi) {
      this.finalTalentIds = [...talentIds]
      this.replacementLog = []
      let pts = this.basePoints
      for (const id of talentIds) {
        const t = this.talentPool.find((x) => x.id === id)
        if (t?.status) pts += t.status
      }
      this.cachedTotalPoints = pts
      return
    }
    this.finalTalentIds = [...talentIds]
    this.replacementLog = this.engine.remake(talentIds)
    this.cachedTotalPoints = this.engine.getPropertyPoints(progression.totalPoints(), talentIds)
    this.cachedLimits = progression.propertyLimits()
  }

  remake(_talentIds: number[]): ReplacementLog[] {
    return this.replacementLog
  }

  getPropertyPoints(): number {
    return this.cachedTotalPoints
  }

  get propertyAllocateLimit(): [number, number] {
    return this.cachedLimits
  }

  get talentSelectLimit(): number {
    return TALENT_SELECT_LIMIT
  }

  start(propertyAllocate: PropertyAllocate): void {
    if (this.useApi) {
      this.pendingAllocation = propertyAllocate
      this.precomputedTurns = []
      this.turnIdx = 0
      return
    }
    this.engine.start(propertyAllocate, this.finalTalentIds)
  }

  async precompute(): Promise<void> {
    if (!this.useApi || !this.api) return
    $$event('loading_status', 'loading_playing')
    const alloc = this.pendingAllocation ?? { CHR: 0, INT: 0, STR: 0, MNY: 0 }
    const r = await this.api.play(this.sessionId, {
      talent_ids: this.finalTalentIds,
      allocation: alloc as unknown as Record<string, number>,
    })
    this.finalTalentIds = r.final_talent_ids
    this.precomputedTurns = r.timeline.map((t) => ({
      age: t.age,
      content: (t.content as ContentItem[]) ?? [],
      isEnd: t.is_end,
      propertySnapshot: t.property_snapshot as unknown as TurnResult['propertySnapshot'],
    }))
    this.turnIdx = 0

    const s = r.summary
    const fate: FateSummary = {
      seed: s.seed,
      fateLevel: s.fate_level as FateSummary['fateLevel'],
      mythEventCount: s.myth_count,
      sum: s.sum,
      HAGE: s.HAGE,
      HCHR: s.HCHR,
      HINT: s.HINT,
      HSTR: s.HSTR,
      HMNY: s.HMNY,
      HSPR: s.HSPR,
      characterName: this.effectiveName(s.character_name ?? this.charName),
      world: s.world ?? this.worldName,
    }
    this.cachedFate = fate
    this.cachedLifeSummary = s.life_summary || ''
    this.cachedTitle = s.title || ''
    this.cachedTraits = Array.isArray(s.traits) ? s.traits : []
    this.cachedSummary = {
      HAGE: fate.HAGE,
      HCHR: fate.HCHR,
      HINT: fate.HINT,
      HSTR: fate.HSTR,
      HMNY: fate.HMNY,
      HSPR: fate.HSPR,
      sum: fate.sum,
      fateLevel: fate.fateLevel,
      mythCount: fate.mythEventCount,
      seed: fate.seed,
      characterName: fate.characterName,
      rows: buildSummaryRows(fate),
    }
  }

  async loadReplay(entry: InscriptionEntry): Promise<{ talents: TalentInfo[]; allocation: PropertyAllocate }> {
    if (!this.useApi || !this.api) throw new Error('回放仅支持后端模式')
    const alloc: PropertyAllocate = entry.allocation
      ? { CHR: entry.allocation.CHR, INT: entry.allocation.INT, STR: entry.allocation.STR, MNY: entry.allocation.MNY }
      : { CHR: 0, INT: 0, STR: 0, MNY: 0 }

    const r = await this.api.replay({
      seed: entry.seed,
      talent_ids: entry.talentIds ?? [],
      allocation: alloc,
      run_count: entry.runCount ?? 0,
      language: progression.lang(),
      character_name: entry.characterName,
    })

    this.resetSession()
    const s = r.summary
    this.seed = s.seed
    this.folder = s.world || entry.world
    this.worldName = worldDisplayName(this.folder, isEn())
    this.charName = entry.characterName || s.character_name || this.charName
    this.finalTalentIds = entry.talentIds ?? []
    this.precomputedTurns = r.timeline.map((t) => ({
      age: t.age,
      content: (t.content as ContentItem[]) ?? [],
      isEnd: t.isEnd,
      propertySnapshot: t.propertySnapshot as unknown as TurnResult['propertySnapshot'],
    }))
    this.turnIdx = 0

    const fate: FateSummary = {
      seed: s.seed, fateLevel: s.fate_level as FateSummary['fateLevel'], mythEventCount: s.myth_count, sum: s.sum,
      HAGE: s.HAGE, HCHR: s.HCHR, HINT: s.HINT, HSTR: s.HSTR, HMNY: s.HMNY, HSPR: s.HSPR,
      characterName: this.charName, world: this.folder,
    }
    this.cachedFate = fate
    this.cachedLifeSummary = entry.summary || s.title || ''
    this.cachedTitle = s.title || entry.title || ''
    this.cachedTraits = Array.isArray(s.traits) && s.traits.length ? s.traits : (entry.traits ?? [])
    this.cachedSummary = {
      HAGE: fate.HAGE, HCHR: fate.HCHR, HINT: fate.HINT, HSTR: fate.HSTR, HMNY: fate.HMNY, HSPR: fate.HSPR,
      sum: fate.sum, fateLevel: fate.fateLevel, mythCount: fate.mythEventCount, seed: fate.seed,
      characterName: fate.characterName, rows: buildSummaryRows(fate),
    }

    return { talents: r.talents ?? [], allocation: alloc }
  }

  private async pollSeedReady(): Promise<GameReadyResp> {
    if (!this.api) throw new Error('api 未初始化')
    for (let i = 0; i < 60; i++) {
      const r = await this.api.gameGet(this.sessionId)
      if (r.status === 'ready') return r
      await sleep(800)
    }
    throw new Error('种子获取超时，请重试')
  }

  next(): TurnResult {
    if (this.useApi) {
      const t = this.precomputedTurns[this.turnIdx]
      if (t) {
        this.turnIdx++
        return t
      }
      const last = this.precomputedTurns[this.precomputedTurns.length - 1]
      return last ?? { age: 0, content: [], isEnd: true, propertySnapshot: { CHR: 0, INT: 0, STR: 0, MNY: 0, SPR: 0 } }
    }
    return this.engine.next()
  }

  get summary(): Summary {
    if (this.useApi) {
      return this.cachedSummary ?? emptySummary(this.seed, this.charName)
    }
    const s = this.engine.getSummary()
    return { ...s, characterName: this.effectiveName(s.characterName) }
  }

  get fateSummary(): FateSummary {
    if (this.useApi) {
      return this.cachedFate ?? stubFate(this.seed, this.charName, this.worldName)
    }
    const f = this.engine.getFateSummary()
    return { ...f, characterName: this.effectiveName(f.characterName) }
  }

  async getLifeSummary(): Promise<string> {
    if (this.useApi) return this.cachedLifeSummary || '……'
    return this.engine.getLifeSummaryText()
  }

  get fateTitle(): string {
    if (this.useApi && this.cachedTitle) return this.cachedTitle
    return fallbackTitle(this.fateSummary)
  }
  get fateTraits(): string[] {
    if (this.useApi && this.cachedTraits.length) return this.cachedTraits
    return fallbackTraits(this.fateSummary)
  }

  async inscribeFate(): Promise<InscriptionEntry> {
    if (this.useApi && this.api) {
      const real = isInscribeConfigured()
      let wallet: string
      if (real) {
        wallet = await chainConnect(!progression.isWalletConnected())
      } else {
        wallet = progression.isWalletConnected()
          ? (progression.walletAddress() as string)
          : progression.connectWallet() 
      }
      progression.connectWallet(wallet) 

      const prep = await this.api.inscribePrepare(this.sessionId, wallet)

      let hash: string
      if (real && prep.signature && prep.allocation) {
        hash = await chainInscribe({
          to: wallet,
          inscriptionId: prep.inscription_id!,
          seed: prep.seed!,
          talentIds: prep.talent_ids!,
          allocation: [prep.allocation.CHR, prep.allocation.INT, prep.allocation.STR, prep.allocation.MNY],
          randcastRequestTx: prep.randcast_request_tx!,
          deadline: prep.deadline!,
          signature: prep.signature,
        })
      } else {
        if (prep.approve_tx) await sendPreparedTx(prep.approve_tx, wallet)
        hash = await sendPreparedTx(prep.mint_tx, wallet)
      }

      const r = await this.api.inscribe(this.sessionId, {
        tx_hash: hash,
        display_name: progression.username() || null,
      })
      progression.addInscription(r.entry)
      await this.refreshShared().catch(() => {})
      return r.entry
    }
    const entry = this.engine.inscribe()
    progression.addInscription(entry)
    return entry
  }

  get mythRegistry(): { list: InscriptionEntry[]; count: number } {
    if (this.useApi && progression.isWalletConnected()) {
      return { list: this.sharedMyRegistry, count: this.sharedMyRegistry.length }
    }
    const list = progression.inscriptions()
    return { list, count: list.length }
  }

  get worldRegistry(): { list: InscriptionEntry[]; count: number } {
    if (this.useApi) return { list: this.sharedRegistry, count: this.sharedRegistry.length }
    const list = this.engine.registryList()
    return { list, count: list.length }
  }

  get worldPollution(): { size: number; pool: PollutionEntry[] } {
    if (this.useApi) return { size: this.sharedPollution.length, pool: this.sharedPollution }
    const pool = this.engine.pollutionPool()
    return { size: pool.length, pool }
  }

  async refreshShared(): Promise<void> {
    if (!this.useApi || !this.api) return
    const wallet = progression.isWalletConnected() ? progression.walletAddress() : null
    const [reg, pol, mine] = await Promise.all([
      this.api.registryList({ limit: 50 }),
      this.api.pollutionList(),
      wallet ? this.api.registryByPlayer(wallet) : Promise.resolve({ entries: [] as InscriptionEntry[] }),
    ])
    this.sharedRegistry = reg.entries ?? []
    this.sharedPollution = pol.entries ?? []
    this.sharedMyRegistry = mine.entries ?? []
  }

  async fetchUserStats(): Promise<{ totalUsers: number; activeUsers: Record<string, number> } | null> {
    if (!this.useApi || !this.api) return null
    const r = await this.api.userStats()
    return { totalUsers: r.total_users, activeUsers: r.active_users }
  }

  get times(): number {
    return this._times
  }
  set times(v: number) {
    this._times = v
    progression.times = v
  }

  get PropertyTypes(): PropTypeMap {
    return PROPERTY_TYPES
  }

  get lastExtendTalent(): number | null {
    try {
      const v = localStorage.getItem(EXT_KEY)
      return v == null ? null : Number(v)
    } catch {
      return null
    }
  }

  talentExtend(talentId: number | null): void {
    try {
      if (talentId == null) localStorage.removeItem(EXT_KEY)
      else localStorage.setItem(EXT_KEY, String(talentId))
    } catch {
    }
  }

  get worldFolder(): string {
    return this.folder
  }
  get worldLabel(): string {
    return this.worldName
  }
  get characterName(): string {
    return this.charName
  }
  get backendEnabled(): boolean {
    return this.useApi
  }

  private resetSession(): void {
    this.finalTalentIds = []
    this.replacementLog = []
    this.precomputedTurns = []
    this.turnIdx = 0
    this.cachedSummary = null
    this.cachedFate = null
    this.cachedLifeSummary = ''
    this.cachedTitle = ''
    this.cachedTraits = []
    this.pendingAllocation = null
  }

  private markInheritedTalent(): void {
    const ext = this.lastExtendTalent
    if (ext == null) return
    const t = this.talentPool.find((x) => x.id === ext)
    if (t) (t as TalentInfo & { inherited?: boolean }).inherited = true
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function rate(v: number): string {
  if (v >= 10) return '卓绝'
  if (v >= 8) return '出众'
  if (v >= 6) return '优良'
  if (v >= 4) return '寻常'
  if (v >= 1) return '平庸'
  return '匮乏'
}

function gradeOf(v: number, lo: number, hi: number): Grade {
  return (v >= hi ? 3 : v >= (lo + hi) / 2 ? 2 : v >= lo ? 1 : 0) as Grade
}

function buildSummaryRows(f: FateSummary): SummaryRow[] {
  return [
    { key: 'HCHR', label: '颜值', value: f.HCHR, grade: gradeOf(f.HCHR, 4, 10), desc: rate(f.HCHR) },
    { key: 'HINT', label: '智力', value: f.HINT, grade: gradeOf(f.HINT, 4, 10), desc: rate(f.HINT) },
    { key: 'HSTR', label: '体质', value: f.HSTR, grade: gradeOf(f.HSTR, 4, 10), desc: rate(f.HSTR) },
    { key: 'HMNY', label: '家境', value: f.HMNY, grade: gradeOf(f.HMNY, 4, 10), desc: rate(f.HMNY) },
    { key: 'HSPR', label: '快乐', value: f.HSPR, grade: gradeOf(f.HSPR, 4, 10), desc: rate(f.HSPR) },
    { key: 'HAGE', label: '享年', value: f.HAGE, grade: gradeOf(f.HAGE, 40, 90), desc: `${f.HAGE} 岁` },
    { key: 'SUM', label: '综评', value: f.sum, grade: gradeOf(f.sum, 60, 110), desc: f.fateLevel + ' 级' },
  ]
}

function stubFate(seed: number, name: string, world: string): FateSummary {
  return {
    seed,
    fateLevel: 'D',
    mythEventCount: 0,
    sum: 0,
    HAGE: 0,
    HCHR: 0,
    HINT: 0,
    HSTR: 0,
    HMNY: 0,
    HSPR: 0,
    characterName: name,
    world,
  }
}

function emptySummary(seed: number, name: string): Summary {
  const f = stubFate(seed, name, '现实')
  return {
    HAGE: 0,
    HCHR: 0,
    HINT: 0,
    HSTR: 0,
    HMNY: 0,
    HSPR: 0,
    sum: 0,
    fateLevel: 'D',
    mythCount: 0,
    seed,
    characterName: name,
    rows: buildSummaryRows(f),
  }
}
