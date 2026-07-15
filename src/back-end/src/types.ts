export type Grade = 0 | 1 | 2 | 3
export type FateLevel = 'S' | 'A' | 'B' | 'C' | 'D'

export interface ContentItem {
  type: 'EVT' | 'TLT' | 'myth_event'
  description: string
  postEvent?: string
  name?: string
  grade: Grade
  instanceId?: string
}

export interface PropertySnapshot {
  CHR: number
  INT: number
  STR: number
  MNY: number
  SPR: number
}

export interface TurnResult {
  age: number
  content: ContentItem[]
  isEnd: boolean
  propertySnapshot: PropertySnapshot
}

export interface TalentInfo {
  id: number
  name: string
  description: string
  grade: Grade
  exclude?: number[]
  status?: number
  effect?: Record<string, number>
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
}

export interface FateSummaryData {
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
  ownerWallet?: string | null
  displayName?: string | null 
  allocation?: { CHR: number; INT: number; STR: number; MNY: number } | null
  randcastRequestTx?: string | null
  runCount?: number
  verifyStatus?: string | null
  nft?: { chain: string; contract: string; tokenId: string; txHash: string } | null
  slotCount?: number
  slotHolders?: unknown[]
}

export interface PlayerSave {
  walletAddress: string
  runCount: number
  bonusPoints: number
  limitExpansion: number
  bestProps: Record<string, number>
  updatedAt: number
}

export interface GameRun {
  id: string
  walletAddress: string
  seed: number
  world: string
  talentIds: number[]
  allocation: { CHR: number; INT: number; STR: number; MNY: number }
  summary: unknown
  playedAt: number
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
