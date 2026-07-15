import type { ContentItem, InscriptionEntry, TalentInfo } from './types'

export interface ApiError {
  error: string
  message: string
  code: number
}

export interface PreparedTx {
  to: string
  data: string
  value: string
  chainId: number
  gas?: string
}

export interface GameNewResp {
  session_id: string
  status: 'awaiting_seed_tx' | 'pending_seed' | 'awaiting_seed'
  seed_tx?: PreparedTx
  est_cost_bnb?: string
  seed_cost_bnb?: string
  consumer?: string
}

export interface GameReadyResp {
  status: 'pending_seed' | 'ready'
  seed?: number
  world?: string
  character_name?: string
  talent_pool?: unknown[]
  total_points?: number
  property_limits?: [number, number]
  spendable_points?: number
  overflow?: number
  spr_init?: number
  talent_luck?: number
  capacity?: number
  run_count?: number
}

export interface PlayResp {
  final_talent_ids: number[]
  timeline: Array<{
    age: number
    content: ContentItem[]
    property_snapshot: { CHR: number; INT: number; STR: number; MNY: number; SPR: number }
    is_end: boolean
  }>
  summary: {
    seed: number
    fate_level: string
    myth_count: number
    sum: number
    HAGE: number
    HCHR: number
    HINT: number
    HSTR: number
    HMNY: number
    HSPR: number
    character_name: string
    world: string
    title: string
    traits: string[]
    life_summary: string
  }
}

interface RawInscription {
  id: string
  seed: number
  title: string
  character_name: string
  traits: string[]
  summary: string
  world: string
  fate_level: string
  sum: number
  HAGE: number
  myth_count: number
  talent_ids: number[]
  allocation?: { CHR: number; INT: number; STR: number; MNY: number }
  randcast_request_tx?: string | null
  run_count?: number
  verify_status?: string | null
  property_peak: { CHR: number; INT: number; STR: number; MNY: number; SPR: number }
  pollution_source_id?: string | null
  owner_wallet?: string | null
  display_name?: string | null
  nft?: { chain: string; contract: string; token_id: string; tx_hash: string } | null
}

const ZERO = '0x0000000000000000000000000000000000000000'

export class ApiClient {
  constructor(private base: string) {
    this.base = base.replace(/\/$/, '')
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(this.base + path, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
    if (!res.ok) {
      let body: ApiError | null = null
      try {
        body = (await res.json()) as ApiError
      } catch {
      }
      throw new Error(body?.message ?? `HTTP ${res.status} on ${path}`)
    }
    return (await res.json()) as T
  }

  gameNew(payload: { language: string; wallet_address: string | null; run_count: number; username?: string | null }) {
    return this.request<GameNewResp>('/game/new', { method: 'POST', body: JSON.stringify(payload) })
  }

  gameGet(id: string) {
    return this.request<GameReadyResp>(`/game/${id}`)
  }

  seedSent(id: string, txHash: string) {
    return this.request<{ ok: boolean }>(`/game/${id}/seed_sent`, {
      method: 'POST',
      body: JSON.stringify({ tx_hash: txHash }),
    })
  }

  submitSeed(id: string, payload: { request_id: string; seed: number; request_tx: string }) {
    return this.request<GameReadyResp>(`/game/${id}/seed`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  play(id: string, payload: { talent_ids: number[]; allocation: Record<string, number> }) {
    return this.request<PlayResp>(`/game/${id}/play`, { method: 'POST', body: JSON.stringify(payload) })
  }

  inscribePrepare(id: string, walletAddress?: string) {
    return this.request<{
      approve_tx: PreparedTx | null
      mint_tx: PreparedTx
      est_cost_token: string
      inscription_id?: string
      deadline?: number
      signature?: string
      seed?: number
      talent_ids?: number[]
      allocation?: { CHR: number; INT: number; STR: number; MNY: number }
      randcast_request_tx?: string
    }>(`/game/${id}/inscribe/prepare`, {
      method: 'POST',
      body: JSON.stringify({ wallet_address: walletAddress ?? null }),
    })
  }

  inscribe(id: string, payload: { tx_hash: string; display_name?: string | null }) {
    return this.request<{ entry: RawInscription }>(`/game/${id}/inscribe`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((r) => ({ entry: mapInscription(r.entry) }))
  }

  registryList(params?: { world?: string; fate_level?: string; cursor?: string; limit?: number }) {
    const q = new URLSearchParams()
    if (params?.world) q.set('world', params.world)
    if (params?.fate_level) q.set('fate_level', params.fate_level)
    if (params?.cursor) q.set('cursor', params.cursor)
    if (params?.limit) q.set('limit', String(params.limit))
    const qs = q.toString()
    return this.request<{ entries: RawInscription[]; next_cursor: string | null }>(
      `/registry/list${qs ? '?' + qs : ''}`,
    ).then((r) => ({ entries: r.entries.map(mapInscription), next_cursor: r.next_cursor }))
  }

  registryByPlayer(wallet: string) {
    return this.request<{ entries: RawInscription[] }>(
      `/registry/by_player?wallet_address=${encodeURIComponent(wallet)}`,
    ).then((r) => ({ entries: r.entries.map(mapInscription) }))
  }

  pollutionChain(inscriptionId: string) {
    return this.request<{ upstream: string[]; downstream: string[] }>(
      `/pollution/chain?inscription_id=${encodeURIComponent(inscriptionId)}`,
    )
  }

  replay(payload: {
    seed: number
    talent_ids: number[]
    allocation: { CHR: number; INT: number; STR: number; MNY: number }
    run_count?: number
    language?: string
    character_name?: string | null
  }) {
    return this.request<{
      summary: {
        seed: number; fate_level: string; myth_count: number; sum: number
        HAGE: number; HCHR: number; HINT: number; HSTR: number; HMNY: number; HSPR: number
        character_name: string; world: string; title: string; traits: string[]
      }
      timeline: Array<{ age: number; content: ContentItem[]; propertySnapshot: Record<string, number>; isEnd: boolean }>
      talents: TalentInfo[]
    }>(`/verify/replay`, { method: 'POST', body: JSON.stringify(payload) })
  }
}

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }

export async function sendPreparedTx(tx: PreparedTx, from?: string): Promise<string> {
  const eth = (window as unknown as { ethereum?: Eth }).ethereum
  if (!eth || tx.to === ZERO) {
    return '0xmock' + Math.random().toString(16).slice(2).padEnd(60, '0').slice(0, 60)
  }
  let account = from
  if (!account) {
    const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
    account = accounts[0]
  }
  const hash = (await eth.request({
    method: 'eth_sendTransaction',
    params: [{ from: account, to: tx.to, data: tx.data, value: tx.value, gas: tx.gas }],
  })) as string
  return hash
}

export async function connectMetaMask(): Promise<string | null> {
  const eth = (window as unknown as { ethereum?: Eth }).ethereum
  if (!eth) return null
  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
  return accounts[0] ?? null
}

function mapInscription(r: RawInscription): InscriptionEntry {
  return {
    id: r.id,
    seed: r.seed,
    title: r.title,
    characterName: r.character_name,
    traits: r.traits ?? [],
    summary: r.summary,
    world: r.world,
    fateLevel: r.fate_level as InscriptionEntry['fateLevel'],
    sum: r.sum,
    HAGE: r.HAGE,
    mythCount: r.myth_count,
    inscribedAt: 0, 
    talentIds: r.talent_ids ?? [],
    propertyPeak: r.property_peak,
    pollutionSourceId: r.pollution_source_id ?? null,
    displayName: r.display_name ?? null,
    ownerWallet: r.owner_wallet ?? null,
    allocation: r.allocation ?? null,
    randcastRequestTx: r.randcast_request_tx ?? null,
    runCount: r.run_count ?? 0,
    verifyStatus: r.verify_status ?? null,
    nft: r.nft ? { chain: r.nft.chain, contract: r.nft.contract, tokenId: r.nft.token_id, txHash: r.nft.tx_hash } : null,
  }
}
