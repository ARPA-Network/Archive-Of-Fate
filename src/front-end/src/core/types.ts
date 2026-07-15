
export type Grade = 0 | 1 | 2 | 3
export type FateLevel = 'S' | 'A' | 'B' | 'C' | 'D'
export type WorldFolder = 'zh-cn' | 'zh-cn-wf' | 'zh-cn-cf'
export type LangCode = 'zh-cn' | 'en'

export interface ContentItem {
  type: 'EVT' | 'TLT' | 'myth_event'
  description: string
  postEvent?: string
  name?: string
  grade: Grade
  instanceId?: string
}

export interface TurnResult {
  age: number
  content: ContentItem[]
  isEnd: boolean
  propertySnapshot: PropertySnapshot
}

export interface PropertySnapshot {
  CHR: number
  INT: number
  STR: number
  MNY: number
  SPR: number
}

export interface PropertyAllocate {
  CHR: number
  INT: number
  STR: number
  MNY: number
}

export interface TalentInfo {
  id: number
  name: string
  description: string
  grade: Grade
  exclude?: number[]
  status?: number
  effect?: Record<string, number>
  inherited?: boolean
}

export interface ReplacementLog {
  from: number
  to: number
}

export interface Summary {
  HAGE: number
  HCHR: number
  HINT: number
  HSTR: number
  HMNY: number
  HSPR: number
  sum: number
  fateLevel: FateLevel
  mythCount: number
  seed: number
  characterName: string
  rows: SummaryRow[]
}

export interface SummaryRow {
  key: string 
  label: string
  value: number
  grade: Grade
  desc: string
}

export interface FateSummary {
  seed: number
  fateLevel: FateLevel
  mythEventCount: number
  sum: number
  HAGE: number
  HCHR: number
  HINT: number
  HSTR: number
  HMNY: number
  HSPR: number
  characterName: string
  world: string
}

export interface InscriptionEntry {
  id: string
  seed: number
  title: string
  characterName: string
  traits: string[]
  summary: string
  world: string
  fateLevel: FateLevel
  sum: number
  HAGE: number
  mythCount: number
  inscribedAt: number
  talentIds: number[]
  propertyPeak: PropertySnapshot
  pollutionSourceId?: string | null
  displayName?: string | null
  ownerWallet?: string | null
  allocation?: { CHR: number; INT: number; STR: number; MNY: number } | null
  randcastRequestTx?: string | null
  runCount?: number
  verifyStatus?: string | null
  nft?: { chain: string; contract: string; tokenId: string; txHash: string } | null
  slotCount?: number
  slotHolders?: SlotHolder[]
}

export interface SlotHolder {
  walletAddress: string
  playerId: string
  purchasedAt: number
  isDisplay: boolean
}

export interface PollutionEntry {
  id: string
  title: string
  characterName: string
  world: string
  traits: string[]
  fateLevel: FateLevel
  seed: number
  summary: string
  addedAt: number
}

export interface AchievementInfo {
  id: number
  name: string
  description: string
  grade: Grade
  hide?: 0 | 1
  unlocked: boolean
  unlockedAt?: number
}

export interface PlayerProgression {
  runCount: number
  bonusPoints: number
  limitExpansion: number
  talentPoolSize: number
  talentGradeBonus: number
}

export interface PropTypeMeta {
  name: string
  color: string
}
export type PropTypeMap = Record<string, PropTypeMeta>

export type FateSummaryLite = FateSummary
