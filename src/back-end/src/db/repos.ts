import { pool, hasDb } from './pool'
import { config } from '../config'
import type { GameRun, InscriptionEntry, PlayerSave, PollutionEntry } from '../types'

const mem = {
  inscriptions: [] as Array<InscriptionEntry & { createdAt: number }>,
  pollution: [] as PollutionEntry[],
  chain: [] as Array<{ upstreamId: string; downstreamId: string; createdAt: number }>,
  playerSaves: new Map<string, PlayerSave>(),
  gameRuns: [] as GameRun[],
  monitor: new Map<string, string>(),
  randcast: new Map<string, unknown>(),
  activity: [] as Array<{ playerId: string; wallet: string | null; createdAt: number }>,
  activitySourceIds: new Set<string>(),
}

export interface ListPage {
  entries: InscriptionEntry[]
  nextCursor: string | null
}

export async function insertInscription(e: InscriptionEntry, createdAt: number): Promise<void> {
  if (hasDb) {
    await pool!.query(
      `INSERT INTO inscription
        (id, seed, title, character_name, traits, summary, world, fate_level, sum, hage, myth_count,
         talent_ids, allocation, property_peak, pollution_source_id, randcast_request_tx,
         owner_wallet, display_name, nft_chain, nft_contract, nft_token_id, nft_tx_hash, run_count, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       ON CONFLICT (id) DO NOTHING`,
      [
        e.id, e.seed, e.title, e.characterName, JSON.stringify(e.traits), e.summary, e.world, e.fateLevel,
        e.sum, e.HAGE, e.mythCount, JSON.stringify(e.talentIds), e.allocation ? JSON.stringify(e.allocation) : null,
        JSON.stringify(e.propertyPeak), e.pollutionSourceId ?? null, e.randcastRequestTx ?? null,
        e.ownerWallet ?? null, e.displayName ?? null,
        e.nft?.chain ?? null, e.nft?.contract ?? null, e.nft?.tokenId ?? null, e.nft?.txHash ?? null,
        e.runCount ?? 0, createdAt,
      ],
    )
    return
  }
  mem.inscriptions.push({ ...e, createdAt })
}

export async function listInscriptions(opts: {
  world?: string
  fateLevel?: string
  cursor?: string
  limit?: number
}): Promise<ListPage> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100)
  const cursorTs = opts.cursor ? Number(opts.cursor) : null

  if (hasDb) {
    const where: string[] = []
    const args: unknown[] = []
    if (opts.world) { args.push(opts.world); where.push(`world=$${args.length}`) }
    if (opts.fateLevel) { args.push(opts.fateLevel); where.push(`fate_level=$${args.length}`) }
    if (cursorTs != null) { args.push(cursorTs); where.push(`created_at < $${args.length}`) }
    args.push(limit)
    const sql = `SELECT * FROM inscription ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY created_at DESC LIMIT $${args.length}`
    const r = await pool!.query(sql, args)
    const entries = r.rows.map(rowToEntry)
    const next = r.rows.length === limit ? String(r.rows[r.rows.length - 1].created_at) : null
    return { entries, nextCursor: next }
  }

  let rows = [...mem.inscriptions].sort((a, b) => b.createdAt - a.createdAt)
  if (opts.world) rows = rows.filter((x) => x.world === opts.world)
  if (opts.fateLevel) rows = rows.filter((x) => x.fateLevel === opts.fateLevel)
  if (cursorTs != null) rows = rows.filter((x) => x.createdAt < cursorTs)
  const page = rows.slice(0, limit)
  const next = page.length === limit ? String(page[page.length - 1].createdAt) : null
  return { entries: page.map(stripCreatedAt), nextCursor: next }
}

export async function getMonitorState(key: string): Promise<string | null> {
  if (hasDb) {
    const r = await pool!.query('SELECT value FROM monitor_state WHERE key=$1', [key])
    return r.rows[0]?.value ?? null
  }
  return mem.monitor.get(key) ?? null
}

export async function setMonitorState(key: string, value: string): Promise<void> {
  if (hasDb) {
    await pool!.query(
      'INSERT INTO monitor_state (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2',
      [key, value],
    )
    return
  }
  mem.monitor.set(key, value)
}

export async function recordRandcastFulfilled(e: {
  requestId: string; consumer: string; requester: string | null
  seed: number; randomness: string; fulfillTx: string; at: number
}): Promise<void> {
  if (hasDb) {
    await pool!.query(
      `INSERT INTO randcast_request
         (request_id, consumer, requester, status, randomness, derived_seed, requested_at, fulfilled_at, fulfill_tx)
       VALUES ($1,$2,$3,'fulfilled',$4,$5,$6,$6,$7)
       ON CONFLICT (request_id) DO UPDATE SET
         status='fulfilled', randomness=$4, derived_seed=$5, fulfilled_at=$6, fulfill_tx=$7,
         requester=COALESCE(randcast_request.requester, $3)`,
      [e.requestId, e.consumer, e.requester, e.randomness, e.seed, e.at, e.fulfillTx],
    )
    return
  }
  mem.randcast.set(e.requestId, e)
}

export async function setInscriptionVerifyStatus(id: string, status: string): Promise<void> {
  if (hasDb) {
    await pool!.query('UPDATE inscription SET verify_status=$2 WHERE id=$1', [id, status])
    return
  }
  const rec = mem.inscriptions.find((x) => x.id === id)
  if (rec) rec.verifyStatus = status
}

export async function inscriptionByTokenId(tokenId: string): Promise<InscriptionEntry | null> {
  if (hasDb) {
    const r = await pool!.query(
      'SELECT * FROM inscription WHERE nft_token_id=$1 ORDER BY created_at DESC LIMIT 1',
      [tokenId],
    )
    return r.rows[0] ? rowToEntry(r.rows[0]) : null
  }
  const found = [...mem.inscriptions].reverse().find((x) => x.nft?.tokenId === tokenId)
  return found ? stripCreatedAt(found) : null
}

export async function inscriptionsByWallet(wallet: string): Promise<InscriptionEntry[]> {
  if (hasDb) {
    const r = await pool!.query('SELECT * FROM inscription WHERE owner_wallet=$1 ORDER BY created_at DESC', [wallet])
    return r.rows.map(rowToEntry)
  }
  return [...mem.inscriptions]
    .filter((x) => x.ownerWallet === wallet)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(stripCreatedAt)
}

export async function addPollution(p: PollutionEntry): Promise<void> {
  if (hasDb) {
    await pool!.query(
      `INSERT INTO pollution_pool (id, title, character_name, world, traits, fate_level, seed, summary, added_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      [p.id, p.title, p.characterName, p.world, JSON.stringify(p.traits), p.fateLevel, p.seed, p.summary, p.addedAt],
    )
    await pool!.query(
      `DELETE FROM pollution_pool WHERE id IN (SELECT id FROM pollution_pool ORDER BY added_at DESC OFFSET $1)`,
      [config.pollutionCap],
    )
    return
  }
  mem.pollution.push(p)
  while (mem.pollution.length > config.pollutionCap) mem.pollution.shift()
}

export async function listPollution(): Promise<PollutionEntry[]> {
  if (hasDb) {
    const r = await pool!.query('SELECT * FROM pollution_pool ORDER BY added_at ASC')
    return r.rows.map((row) => ({
      id: row.id, title: row.title, characterName: row.character_name, world: row.world,
      traits: row.traits, fateLevel: row.fate_level, seed: row.seed, summary: row.summary, addedAt: Number(row.added_at),
    }))
  }
  return [...mem.pollution]
}

export async function addPollutionChain(upstreamId: string, downstreamId: string, at: number): Promise<void> {
  if (hasDb) {
    await pool!.query(
      `INSERT INTO pollution_chain (upstream_id, downstream_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [upstreamId, downstreamId, at],
    )
    return
  }
  if (!mem.chain.some((c) => c.upstreamId === upstreamId && c.downstreamId === downstreamId)) {
    mem.chain.push({ upstreamId, downstreamId, createdAt: at })
  }
}

export async function pollutionChainOf(id: string): Promise<{ upstream: string[]; downstream: string[] }> {
  if (hasDb) {
    const up = await pool!.query('SELECT downstream_id FROM pollution_chain WHERE upstream_id=$1', [id])
    const down = await pool!.query('SELECT upstream_id FROM pollution_chain WHERE downstream_id=$1', [id])
    return { upstream: up.rows.map((r) => r.downstream_id), downstream: down.rows.map((r) => r.upstream_id) }
  }
  return {
    upstream: mem.chain.filter((c) => c.upstreamId === id).map((c) => c.downstreamId),
    downstream: mem.chain.filter((c) => c.downstreamId === id).map((c) => c.upstreamId),
  }
}

export async function getPlayerSave(wallet: string): Promise<PlayerSave | null> {
  if (hasDb) {
    const r = await pool!.query('SELECT * FROM player_save WHERE wallet_address=$1', [wallet])
    if (!r.rows[0]) return null
    const row = r.rows[0]
    return {
      walletAddress: row.wallet_address, runCount: row.run_count, bonusPoints: row.bonus_points,
      limitExpansion: row.limit_expansion, bestProps: row.best_props, updatedAt: Number(row.updated_at),
    }
  }
  return mem.playerSaves.get(wallet) ?? null
}

export async function upsertPlayerSave(s: PlayerSave): Promise<void> {
  if (hasDb) {
    await pool!.query(
      `INSERT INTO player_save (wallet_address, run_count, bonus_points, limit_expansion, best_props, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (wallet_address) DO UPDATE SET run_count=$2, bonus_points=$3, limit_expansion=$4, best_props=$5, updated_at=$6`,
      [s.walletAddress, s.runCount, s.bonusPoints, s.limitExpansion, JSON.stringify(s.bestProps), s.updatedAt],
    )
    return
  }
  mem.playerSaves.set(s.walletAddress, s)
}

export async function insertGameRun(g: GameRun): Promise<void> {
  if (hasDb) {
    await pool!.query(
      `INSERT INTO game_run (id, wallet_address, seed, world, talent_ids, allocation, summary, played_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [g.id, g.walletAddress, g.seed, g.world, JSON.stringify(g.talentIds), JSON.stringify(g.allocation),
       JSON.stringify(g.summary), g.playedAt],
    )
    return
  }
  mem.gameRuns.push(g)
}

export async function recordActivity(
  playerId: string, wallet: string | null, at: number, sourceRequestId?: string,
): Promise<boolean> {
  if (hasDb) {
    const r = await pool!.query(
      `INSERT INTO activity_log (player_id, wallet_address, created_at, source_request_id)
       VALUES ($1,$2,$3,$4) ON CONFLICT (source_request_id) DO NOTHING`,
      [playerId, wallet, at, sourceRequestId ?? null],
    )
    return (r.rowCount ?? 0) > 0
  }
  if (sourceRequestId && mem.activitySourceIds.has(sourceRequestId)) return false
  if (sourceRequestId) mem.activitySourceIds.add(sourceRequestId)
  mem.activity.push({ playerId, wallet, createdAt: at })
  return true
}

export const USER_STATS_WINDOWS: Record<string, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  '3month': 90 * 24 * 60 * 60 * 1000,
  '6month': 180 * 24 * 60 * 60 * 1000,
}

export interface UserStats {
  totalUsers: number
  activeUsers: Record<string, number>
}

export async function getUserStats(window?: string): Promise<UserStats> {
  const now = Date.now()
  const windows = window ? { [window]: USER_STATS_WINDOWS[window] } : USER_STATS_WINDOWS
  const activeUsers: Record<string, number> = {}

  if (hasDb) {
    const totalRes = await pool!.query(
      'SELECT COUNT(DISTINCT COALESCE(wallet_address, player_id))::int AS n FROM activity_log',
    )
    for (const [key, ms] of Object.entries(windows)) {
      const r = await pool!.query(
        `SELECT COUNT(DISTINCT COALESCE(wallet_address, player_id))::int AS n
         FROM activity_log WHERE created_at >= $1`,
        [now - ms],
      )
      activeUsers[key] = r.rows[0].n
    }
    return { totalUsers: totalRes.rows[0].n, activeUsers }
  }

  const identityOf = (a: { playerId: string; wallet: string | null }) => a.wallet ?? a.playerId
  for (const [key, ms] of Object.entries(windows)) {
    const cutoff = now - ms
    const identities = new Set(mem.activity.filter((a) => a.createdAt >= cutoff).map(identityOf))
    activeUsers[key] = identities.size
  }
  return { totalUsers: new Set(mem.activity.map(identityOf)).size, activeUsers }
}

function stripCreatedAt(x: InscriptionEntry & { createdAt: number }): InscriptionEntry {
  const { createdAt, ...rest } = x
  void createdAt
  return rest
}

function rowToEntry(row: Record<string, unknown>): InscriptionEntry {
  const nft = row.nft_token_id != null
    ? { chain: String(row.nft_chain), contract: String(row.nft_contract), tokenId: String(row.nft_token_id), txHash: String(row.nft_tx_hash) }
    : null
  return {
    id: String(row.id),
    seed: Number(row.seed),
    title: String(row.title),
    characterName: String(row.character_name),
    traits: row.traits as string[],
    summary: String(row.summary),
    world: String(row.world),
    fateLevel: row.fate_level as InscriptionEntry['fateLevel'],
    sum: Number(row.sum),
    HAGE: Number(row.hage),
    mythCount: Number(row.myth_count),
    inscribedAt: Number(row.created_at),
    talentIds: row.talent_ids as number[],
    allocation: (row.allocation as InscriptionEntry['allocation']) ?? null,
    propertyPeak: row.property_peak as InscriptionEntry['propertyPeak'],
    pollutionSourceId: (row.pollution_source_id as string) ?? null,
    randcastRequestTx: (row.randcast_request_tx as string) ?? null,
    runCount: Number(row.run_count ?? 0),
    verifyStatus: (row.verify_status as string) ?? null,
    ownerWallet: (row.owner_wallet as string) ?? null,
    displayName: (row.display_name as string) ?? null,
    nft,
  }
}
