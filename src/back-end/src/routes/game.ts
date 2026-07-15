import { Router, type Request, type Response } from 'express'
import type { SessionManager } from '../engine/sessionManager'
import type { PollutionService } from '../services/pollution'
import { config } from '../config'
import { generateLifeSummaryAI } from '../services/aiSummary'
import { signMint, mintSignerConfigured } from '../services/mintSigner'
import {
  chainVerifyConfigured,
  verifyMint,
  seedVerifyConfigured,
  verifySeed,
  operatorConfigured,
  requestSeedForSession,
  readSeed,
} from '../services/chainVerifier'
import {
  addPollution,
  addPollutionChain,
  getPlayerSave,
  insertGameRun,
  insertInscription,
  inscriptionByTokenId,
  inscriptionsByWallet,
  listInscriptions,
  pollutionChainOf,
  upsertPlayerSave,
} from '../db/repos'
import type { InscriptionEntry, PollutionEntry, PropertySnapshot } from '../types'

const ZERO = '0x0000000000000000000000000000000000000000'
const PLAY_GUARD = 600

interface Allocation { CHR: number; INT: number; STR: number; MNY: number }

interface AdapterState {
  wallet: string | null
  language: string
  username: string | null
  runCount: number
  limitExpansion: number
  awaitingClientSeed: boolean 
  operatorRequestId: string | null 
  allocation: Allocation | null
  finalTalentIds: number[] | null 
  seedRequestTx: string | null
  lifeSummary: string | null
  inscriptionId: string | null
  prepared: {
    seed: number
    world: string
    characterName: string
    talentPool: unknown[]
    totalPoints: number
    propertyLimits: [number, number]
    spendablePoints: number
    overflow: number
    sprInit: number
    talentLuck: number
    capacity: number
    runCount: number
  } | null
}

export function createGameRouter(mgr: SessionManager, pollution: PollutionService): Router {
  const router = Router()
  const adapters = new Map<string, AdapterState>()

  const NOISY_CODES = new Set(['SESSION_NOT_FOUND', 'GAME_LIMIT_REACHED'])
  const err = (req: Request, res: Response, error: string, code: number, message: string): void => {
    if (!NOISY_CODES.has(error)) {
      console.warn(`[game:${req.params.id ?? '-'}] ${req.method} ${req.path} ${error}(${code}) ${message}`)
    }
    res.status(code).json({ error, message, code })
  }
  const getSession = (req: Request, res: Response) => {
    const s = mgr.get(req.params.id)
    if (!s) { err(req, res, 'SESSION_NOT_FOUND', 404, `Session ${req.params.id} not found or expired`); return null }
    return s
  }
  const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response): void => {
    fn(req, res).catch((e: unknown) => {
      console.error(`[game:${req.params.id ?? '-'}] ${req.method} ${req.path} unhandled exception`, e)
      err(req, res, 'INTERNAL_ERROR', 500, (e as Error).message)
    })
  }

  router.post('/game/new', wrap(async (req, res) => {
    const body = req.body ?? {}
    const wallet: string | null = body.wallet_address ?? null
    const language: string = body.language ?? 'zh-cn'
    const username: string | null = (body.username as string | undefined)?.trim() || null

    const anonCount = Number(body.run_count ?? 0)
    let runCount = 0
    let limitExpansion = 0
    if (wallet) {
      const save = await getPlayerSave(wallet)
      if (save) { runCount = save.runCount; limitExpansion = save.limitExpansion }
    } else if (anonCount >= config.anonGameLimit) {
      return err(req, res, 'GAME_LIMIT_REACHED', 429, 'Anonymous game limit reached, connect wallet')
    }

    const session = mgr.create()
    const base = {
      wallet, language, username, runCount, limitExpansion,
      allocation: null, finalTalentIds: null, seedRequestTx: null,
      lifeSummary: null, inscriptionId: null,
      operatorRequestId: null as string | null,
    }

    if (wallet && seedVerifyConfigured()) {
      adapters.set(session.id, { ...base, awaitingClientSeed: true, prepared: null })
      res.json({
        session_id: session.id,
        status: 'awaiting_seed',
        seed_cost_bnb: config.chain.seedCostBnb,
        consumer: config.chain.consumer,
      })
      return
    }

    if (!wallet && operatorConfigured()) {
      const { requestId, txHash } = await requestSeedForSession(session.id)
      adapters.set(session.id, {
        ...base, awaitingClientSeed: false, operatorRequestId: requestId, seedRequestTx: txHash, prepared: null,
      })
      res.json({ session_id: session.id, status: 'pending_seed' })
      return
    }

    const prepared = session.prepareLife({ runCount, limitExpansion, language, characterName: username })
    adapters.set(session.id, { ...base, awaitingClientSeed: false, prepared })

    if (wallet) {
      res.json({
        session_id: session.id,
        status: 'awaiting_seed_tx',
        seed_tx: { to: ZERO, data: '0x', value: '0x38d7ea4c68000', chainId: 56, gas: '0x493e0' },
        est_cost_bnb: '0.001',
      })
    } else {
      res.json({ session_id: session.id, status: 'pending_seed' })
    }
  }))

  router.get('/game/:id', wrap(async (req, res) => {
    const s = getSession(req, res)
    if (!s) return
    const a = adapters.get(s.id)
    if (!a) return err(req, res, 'SEED_NOT_READY', 409, 'Seed not ready')

    if (!a.prepared && a.operatorRequestId) {
      const { seed, fulfilled } = await readSeed(a.operatorRequestId)
      if (!fulfilled) { res.json({ status: 'pending_seed' }); return }
      a.prepared = s.prepareLife({ runCount: a.runCount, limitExpansion: a.limitExpansion, language: a.language, seed, characterName: a.username })
    }

    if (!a.prepared) { res.json({ status: 'pending_seed' }); return }
    const p = a.prepared
    res.json({
      status: 'ready',
      seed: p.seed,
      world: p.world,
      character_name: p.characterName,
      talent_pool: p.talentPool,
      total_points: p.totalPoints,
      property_limits: p.propertyLimits,
      spendable_points: p.spendablePoints,
      overflow: p.overflow,
      spr_init: p.sprInit,
      talent_luck: p.talentLuck,
      capacity: p.capacity,
      run_count: p.runCount,
    })
  }))

  router.post('/game/:id/seed_sent', (req, res) => {
    const s = getSession(req, res)
    if (!s) return
    const a = adapters.get(s.id)
    const txHash: string | undefined = req.body?.tx_hash
    if (a && txHash) a.seedRequestTx = txHash
    res.json({ ok: true })
  })

  router.post('/game/:id/seed', wrap(async (req, res) => {
    const s = getSession(req, res)
    if (!s) return
    const a = adapters.get(s.id)
    if (!a) return err(req, res, 'SESSION_NOT_FOUND', 404, 'Session not found')
    if (!a.awaitingClientSeed) return err(req, res, 'SESSION_STATE_INVALID', 409, 'This session does not accept a client-supplied seed')
    if (a.prepared) return err(req, res, 'SESSION_STATE_INVALID', 409, 'This session is already prepared')

    const requestId: string = String(req.body?.request_id ?? '')
    const seed = Number(req.body?.seed)
    const requestTx: string | null = (req.body?.request_tx as string) || null
    if (!requestId || !Number.isFinite(seed)) {
      return err(req, res, 'BAD_REQUEST', 400, 'Missing request_id / seed')
    }

    try {
      await verifySeed(requestId, seed, a.wallet ?? undefined)
    } catch (e) {
      return err(req, res, 'SEED_VERIFY_FAILED', 400, `Seed verification failed: ${(e as Error).message}`)
    }

    const prepared = s.prepareLife({ runCount: a.runCount, limitExpansion: a.limitExpansion, language: a.language, seed, characterName: a.username })
    a.prepared = prepared
    a.awaitingClientSeed = false
    a.seedRequestTx = requestTx ?? requestId 

    res.json({
      status: 'ready',
      seed: prepared.seed,
      world: prepared.world,
      character_name: prepared.characterName,
      talent_pool: prepared.talentPool,
      total_points: prepared.totalPoints,
      property_limits: prepared.propertyLimits,
      spendable_points: prepared.spendablePoints,
      overflow: prepared.overflow,
      spr_init: prepared.sprInit,
      talent_luck: prepared.talentLuck,
      capacity: prepared.capacity,
      run_count: prepared.runCount,
    })
  }))

  router.post('/game/:id/play', wrap(async (req, res) => {
    const s = getSession(req, res)
    if (!s) return
    const a = adapters.get(s.id)
    if (!a || !a.prepared) return err(req, res, 'SESSION_STATE_INVALID', 409, 'Session not prepared')

    const talentIds: number[] = Array.isArray(req.body?.talent_ids) ? req.body.talent_ids.map(Number) : []
    if (talentIds.length !== 3 || new Set(talentIds).size !== 3) {
      return err(req, res, 'INVALID_TALENT_SELECTION', 400, 'Must select exactly 3 distinct talents')
    }
    const poolIds = new Set((a.prepared.talentPool as Array<{ id: number }>).map((t) => t.id))
    if (!talentIds.every((id) => poolIds.has(id))) {
      return err(req, res, 'INVALID_TALENT_SELECTION', 400, 'Talent is not in this session\'s candidate pool')
    }

    const allocRaw = req.body?.allocation ?? {}
    const allocation: Allocation = {
      CHR: Number(allocRaw.CHR ?? 0), INT: Number(allocRaw.INT ?? 0),
      STR: Number(allocRaw.STR ?? 0), MNY: Number(allocRaw.MNY ?? 0),
    }

    const sel = s.selectTalents(talentIds)
    const finalTalentIds = sel.finalTalentIds

    const [lo, hi] = sel.propertyLimits
    const budget = Math.min(sel.totalPoints, 4 * hi)
    const vals = [allocation.CHR, allocation.INT, allocation.STR, allocation.MNY]
    if (vals.some((v) => !Number.isInteger(v) || v < lo || v > hi)) {
      return err(req, res, 'INVALID_ALLOCATION', 400, `Attribute allocation out of range: each must be an integer in [${lo}, ${hi}]`)
    }
    if (vals.reduce((acc, v) => acc + v, 0) > budget) {
      return err(req, res, 'INVALID_ALLOCATION', 400, `Attribute allocation exceeds budget: sum of all four must not exceed ${budget}`)
    }

    a.allocation = allocation
    a.finalTalentIds = finalTalentIds
    s.start(allocation as unknown as Record<string, number>)

    const timeline: Array<{ age: number; content: unknown; property_snapshot: unknown; is_end: boolean }> = []
    for (let i = 0; i < PLAY_GUARD; i++) {
      const t = s.next()
      timeline.push({ age: t.age, content: t.content, property_snapshot: t.propertySnapshot, is_end: t.isEnd })
      if (t.isEnd) break
    }

    const sum = s.getSummary()
    const fate = s.getFateSummaryData()
    const lifeSummary = await generateLifeSummaryAI(fate, s.getEventLog(), a.language)
    a.lifeSummary = lifeSummary

    const summary = {
      seed: sum.seed, fate_level: sum.fateLevel, myth_count: sum.mythCount, sum: sum.sum,
      HAGE: sum.HAGE, HCHR: sum.HCHR, HINT: sum.HINT, HSTR: sum.HSTR, HMNY: sum.HMNY, HSPR: sum.HSPR,
      character_name: sum.characterName, world: fate.world,
      title: s.getTitle(), traits: s.getTraits(), life_summary: lifeSummary,
    }

    if (a.wallet) {
      const now = Date.now()
      const peak: PropertySnapshot = { CHR: sum.HCHR, INT: sum.HINT, STR: sum.HSTR, MNY: sum.HMNY, SPR: sum.HSPR }
      await insertGameRun({
        id: `run_${s.id}`, walletAddress: a.wallet, seed: a.prepared.seed, world: fate.world,
        talentIds: finalTalentIds, allocation, summary, playedAt: now,
      })
      const save = (await getPlayerSave(a.wallet)) ?? {
        walletAddress: a.wallet, runCount: 0, bonusPoints: 0, limitExpansion: 0, bestProps: {}, updatedAt: now,
      }
      save.runCount += 1
      save.bonusPoints = save.runCount
      save.limitExpansion = Math.floor(save.runCount / 10)
      save.bestProps = mergeBest(save.bestProps, peak)
      save.updatedAt = now
      await upsertPlayerSave(save)
    }

    res.json({ final_talent_ids: finalTalentIds, timeline, summary })
  }))

  router.post('/verify/replay', wrap(async (req, res) => {
    const seed = Number(req.body?.seed)
    const talentIds: number[] = Array.isArray(req.body?.talent_ids) ? req.body.talent_ids.map(Number) : []
    const allocRaw = req.body?.allocation ?? {}
    const allocation: Record<string, number> = {
      CHR: Number(allocRaw.CHR ?? 0), INT: Number(allocRaw.INT ?? 0),
      STR: Number(allocRaw.STR ?? 0), MNY: Number(allocRaw.MNY ?? 0),
    }
    const runCount = Number(req.body?.run_count ?? 0)
    const language: string = req.body?.language ?? 'zh-cn'
    const characterName: string | null = (req.body?.character_name as string | undefined)?.trim() || null
    if (!Number.isFinite(seed) || seed <= 0 || talentIds.length === 0) {
      return err(req, res, 'BAD_REQUEST', 400, 'Missing seed / talent_ids')
    }
    const s = mgr.create()
    try {
      const r = s.replay({ seed, runCount, finalTalentIds: talentIds, allocation, language, characterName })
      res.json({ summary: r.summary, timeline: r.timeline, talents: r.talents })
    } finally {
      mgr.remove(s.id)
    }
  }))

  router.post('/game/:id/inscribe/prepare', wrap(async (req, res) => {
    const s = getSession(req, res)
    if (!s) return
    const a = adapters.get(s.id)
    if (!a || !a.prepared) return err(req, res, 'SESSION_STATE_INVALID', 409, 'Session not prepared')
    const bodyWallet = (req.body?.wallet_address as string) || null
    if (bodyWallet) a.wallet = bodyWallet
    if (!a.wallet) return err(req, res, 'BAD_REQUEST', 400, 'Inscribing requires a connected wallet')
    if (!a.allocation || !a.finalTalentIds) return err(req, res, 'SESSION_STATE_INVALID', 409, 'Complete /play for this session first')
    if (!a.inscriptionId) a.inscriptionId = `fate_${a.prepared.seed}_${Date.now()}`

    const resp: Record<string, unknown> = {
      inscription_id: a.inscriptionId,
      est_cost_token: '50',
      approve_tx: { to: ZERO, data: '0x', value: '0x0', chainId: config.chain.chainId },
      mint_tx: { to: ZERO, data: '0x', value: '0x0', chainId: config.chain.chainId, gas: '0x7a120' },
    }

    if (mintSignerConfigured()) {
      const auth = await signMint({
        to: a.wallet,
        inscriptionId: a.inscriptionId,
        seed: a.prepared.seed,
        talentIds: a.finalTalentIds,
        allocation: a.allocation,
        randcastRequestTx: a.seedRequestTx,
      })
      resp.deadline = auth.deadline
      resp.signature = auth.signature
      resp.seed = a.prepared.seed
      resp.talent_ids = a.finalTalentIds
      resp.allocation = a.allocation
      resp.randcast_request_tx = auth.randcastRequestTx
    }

    res.json(resp)
  }))

  router.post('/game/:id/inscribe', wrap(async (req, res) => {
    const s = getSession(req, res)
    if (!s) return
    const a = adapters.get(s.id)
    if (!a || !a.prepared) return err(req, res, 'SESSION_STATE_INVALID', 409, 'Session not prepared')
    if (!a.wallet) return err(req, res, 'BAD_REQUEST', 400, 'Inscribing requires a connected wallet')
    const txHash: string | undefined = req.body?.tx_hash
    if (!txHash) return err(req, res, 'BAD_REQUEST', 400, 'Missing tx_hash')

    let nft = { chain: 'bsc', contract: ZERO, tokenId: String(Math.floor(Math.random() * 1_000_000) + 1), txHash }
    if (chainVerifyConfigured()) {
      if (!a.inscriptionId) return err(req, res, 'SESSION_STATE_INVALID', 409, 'Call /inscribe/prepare first')
      try {
        const v = await verifyMint(txHash, {
          inscriptionId: a.inscriptionId,
          owner: a.wallet,
          seed: a.prepared.seed,
        })
        nft = { chain: 'bsc', contract: v.contract, tokenId: v.tokenId, txHash }
      } catch (e) {
        return err(req, res, 'CHAIN_VERIFY_FAILED', 400, `On-chain verification failed: ${(e as Error).message}`)
      }
    }

    const core = s.inscribe()
    const now = Date.now()
    const username = ((req.body?.display_name as string) || '').trim() || null
    const entry: InscriptionEntry = {
      ...core,
      id: a.inscriptionId ?? core.id,
      characterName: username || core.characterName,
      summary: a.lifeSummary ?? core.summary, 
      ownerWallet: a.wallet,
      displayName: username,
      allocation: a.allocation,
      randcastRequestTx: a.seedRequestTx,
      runCount: a.runCount,
      nft,
    }

    await insertInscription(entry, now)
    const pe = toPollutionEntry(entry, now)
    await addPollution(pe)
    pollution.add(pe)
    if (entry.pollutionSourceId) await addPollutionChain(entry.pollutionSourceId, entry.id, now)

    res.status(201).json({ entry: toSnakeEntry(entry) })
  }))

  router.get('/registry/list', wrap(async (req, res) => {
    const page = await listInscriptions({
      world: req.query.world as string | undefined,
      fateLevel: req.query.fate_level as string | undefined,
      cursor: req.query.cursor as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    })
    res.json({ entries: page.entries.map(toSnakeEntry), next_cursor: page.nextCursor })
  }))

  router.get('/registry/by_player', wrap(async (req, res) => {
    const wallet = req.query.wallet_address as string | undefined
    if (!wallet) return err(req, res, 'BAD_REQUEST', 400, 'Missing wallet_address')
    const entries = await inscriptionsByWallet(wallet)
    res.json({ entries: entries.map(toSnakeEntry) })
  }))

  router.get('/pollution/chain', wrap(async (req, res) => {
    const id = req.query.inscription_id as string | undefined
    if (!id) return err(req, res, 'BAD_REQUEST', 400, 'Missing inscription_id')
    res.json(await pollutionChainOf(id))
  }))

  router.get('/nft/:tokenId', wrap(async (req, res) => {
    const tokenId = String(req.params.tokenId).replace(/\.json$/i, '') 
    const e = await inscriptionByTokenId(tokenId)
    if (!e) return err(req, res, 'NOT_FOUND', 404, 'No inscription record for this tokenId')
    res.json(buildMetadata(e, tokenId))
  }))

  return router
}

function buildMetadata(e: InscriptionEntry, tokenId: string): Record<string, unknown> {
  const image = config.nft.imageBase
    ? `${config.nft.imageBase}${tokenId}.png`
    : config.nft.defaultImage || ''
  const meta: Record<string, unknown> = {
    name: `${e.title} · ${e.characterName}`,
    description: e.summary,
    image,
    attributes: [
      { trait_type: 'World', value: e.world },
      { trait_type: 'Fate Level', value: e.fateLevel },
      { trait_type: 'Seed', value: e.seed },
      { display_type: 'number', trait_type: 'Age', value: e.HAGE },
      { display_type: 'number', trait_type: 'Sum', value: e.sum },
      { display_type: 'number', trait_type: 'Myths', value: e.mythCount },
      ...e.traits.map((t) => ({ trait_type: 'Trait', value: t })),
    ],
  }
  if (config.nft.externalBase) meta.external_url = `${config.nft.externalBase}${e.id}`
  return meta
}

function mergeBest(prev: Record<string, number>, peak: PropertySnapshot): Record<string, number> {
  const out = { ...prev }
  for (const [k, v] of Object.entries(peak)) out[k] = Math.max(out[k] ?? 0, v as number)
  return out
}

function toPollutionEntry(e: InscriptionEntry, addedAt: number): PollutionEntry {
  return {
    id: e.id, title: e.title, characterName: e.characterName, world: e.world,
    traits: e.traits, fateLevel: e.fateLevel, seed: e.seed, summary: e.summary, addedAt,
  }
}

function toSnakeEntry(e: InscriptionEntry): Record<string, unknown> {
  return {
    id: e.id,
    seed: e.seed,
    title: e.title,
    character_name: e.characterName,
    traits: e.traits,
    summary: e.summary,
    world: e.world,
    fate_level: e.fateLevel,
    sum: e.sum,
    HAGE: e.HAGE,
    myth_count: e.mythCount,
    talent_ids: e.talentIds,
    allocation: e.allocation ?? null,
    randcast_request_tx: e.randcastRequestTx ?? null,
    run_count: e.runCount ?? 0,
    verify_status: e.verifyStatus ?? null,
    property_peak: e.propertyPeak,
    pollution_source_id: e.pollutionSourceId ?? null,
    owner_wallet: e.ownerWallet ?? null,
    display_name: e.displayName ?? null,
    nft: e.nft
      ? { chain: e.nft.chain, contract: e.nft.contract, token_id: e.nft.tokenId, tx_hash: e.nft.txHash }
      : null,
  }
}
