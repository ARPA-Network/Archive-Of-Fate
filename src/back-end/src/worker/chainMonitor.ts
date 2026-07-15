import '../loadEnv'
import fs from 'fs'
import path from 'path'
import { JsonRpcProvider, Interface, Contract } from 'ethers'
import { config } from '../config'
import { DataStore } from '../engine/dataLoader'
import { SessionManager } from '../engine/sessionManager'
import { MockAIService } from '../services/aiService'
import { PollutionService } from '../services/pollution'
import type { Services } from '../engine/session'
import {
  getMonitorState,
  setMonitorState,
  recordRandcastFulfilled,
  inscriptionByTokenId,
  setInscriptionVerifyStatus,
} from '../db/repos'
import { pool, hasDb } from '../db/pool'
import type { InscriptionEntry } from '../types'


const CONSUMER_ABI = [
  'event SeedFulfilled(bytes32 indexed requestId, uint256 seed, address indexed requester, uint256 randomness)',
]
const NFT_EVENT_ABI = [
  'event InscriptionMinted(uint256 indexed tokenId, address indexed owner, string inscriptionId, uint256 seed, bytes32 randcastRequestTx, uint256 paidToken)',
]
const NFT_READ_ABI = [
  'function getFate(uint256 tokenId) view returns (uint256 seed, uint256[] talentIds, int256[4] allocation, bytes32 randcastRequestTx)',
  'function ownerOf(uint256 tokenId) view returns (address)',
]

const CHUNK = Number(process.env.MONITOR_CHUNK || 1000)
const INTERVAL = Number(process.env.MONITOR_INTERVAL_MS || 15000)
const CONFIRMATIONS = Number(process.env.MONITOR_CONFIRMATIONS || 5)
const CURSOR_KEY = 'chain_cursor_block'

interface MinLog { address: string; topics: readonly string[]; data: string; transactionHash: string }

let effectiveChunk = CHUNK

function rpcErrorMessage(e: unknown): string {
  const withInfo = e as { info?: { responseBody?: string }; shortMessage?: string; message?: string }
  return String(withInfo?.info?.responseBody ?? withInfo?.shortMessage ?? withInfo?.message ?? e)
}

function isBlockRangeLimitError(e: unknown): boolean {
  return rpcErrorMessage(e).toLowerCase().includes('block range')
}

function parseBlockRangeSuggestion(e: unknown): number | null {
  const m = rpcErrorMessage(e).match(/\[\s*0x([0-9a-fA-F]+)\s*,\s*0x([0-9a-fA-F]+)\s*\]/)
  if (!m) return null
  const size = parseInt(m[2], 16) - parseInt(m[1], 16) + 1
  return size > 0 ? size : null
}

function isTransient(e: unknown): boolean {
  if (isBlockRangeLimitError(e)) return false
  const msg = String((e as Error)?.message ?? e).toLowerCase()
  const code = (e as { code?: string; error?: { code?: number } })?.code
  const innerCode = (e as { error?: { code?: number } })?.error?.code
  return (
    code === 'BAD_DATA' || code === 'TIMEOUT' || code === 'NETWORK_ERROR' || code === 'SERVER_ERROR' ||
    innerCode === -32005 || msg.includes('rate limit') || msg.includes('timeout') || msg.includes('429')
  )
}

async function withRetry<T>(fn: () => Promise<T>, label: string, tries = 4): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (!isTransient(e) || i === tries - 1) throw e
      const delay = 500 * 2 ** i + Math.floor(Math.random() * 300)
      console.warn(`[monitor] ${label} transient error, retrying in ${delay}ms (${i + 1}/${tries}): ${(e as Error).message?.slice(0, 100)}`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}

function safeParse(iface: Interface, log: MinLog): { name: string; args: Record<string, unknown> } | null {
  try {
    const p = iface.parseLog({ topics: [...log.topics], data: log.data })
    return p ? { name: p.name, args: p.args as unknown as Record<string, unknown> } : null
  } catch {
    return null
  }
}

const eqNumArr = (a: number[], b: number[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])

async function fetchLogsAdaptive(
  provider: JsonRpcProvider, address: string[], from: number, to: number,
): Promise<MinLog[]> {
  const logs: MinLog[] = []
  let start = from
  let guard = 0
  while (start <= to && guard++ < 10000) {
    const end = Math.min(start + effectiveChunk - 1, to)
    try {
      const chunk = (await withRetry(
        () => provider.getLogs({ address, fromBlock: start, toBlock: end }),
        `getLogs[${start}-${end}]`,
      )) as unknown as MinLog[]
      logs.push(...chunk)
      start = end + 1
    } catch (e) {
      if (!isBlockRangeLimitError(e)) throw e
      const suggested = parseBlockRangeSuggestion(e)
      const next = Math.max(1, Math.min(suggested ?? Math.floor(effectiveChunk / 2), effectiveChunk - 1))
      console.warn(`[monitor] RPC block range exceeded, shrinking scan chunk from ${effectiveChunk} to ${next}: ${rpcErrorMessage(e).slice(0, 160)}`)
      effectiveChunk = next
    }
  }
  return logs
}

async function verifyRecord(mgr: SessionManager, nft: Contract | null, rec: InscriptionEntry): Promise<string> {
  const reasons: string[] = []
  const tokenId = rec.nft?.tokenId
  const alloc = rec.allocation ?? { CHR: 0, INT: 0, STR: 0, MNY: 0 }
  const allocArr = [alloc.CHR, alloc.INT, alloc.STR, alloc.MNY]
  const talents = rec.talentIds ?? []

  if (nft && tokenId) {
    try {
      const fate = await withRetry(() => nft.getFate(tokenId) as Promise<[bigint, bigint[], bigint[], string]>, 'getFate')
      const owner = String(await withRetry(() => nft.ownerOf(tokenId), 'ownerOf'))
      const chainSeed = Number(fate[0])
      const chainTalents = (fate[1] ?? []).map((x) => Number(x))
      const chainAlloc = (fate[2] ?? []).map((x) => Number(x))
      if (chainSeed !== rec.seed) reasons.push(`seed(chain=${chainSeed},db=${rec.seed})`)
      if (!eqNumArr(chainTalents, talents)) reasons.push('talents≠chain')
      if (!eqNumArr(chainAlloc, allocArr)) reasons.push('allocation≠chain')
      if (rec.ownerWallet && owner.toLowerCase() !== rec.ownerWallet.toLowerCase()) {
        reasons.push(`owner(chain=${owner},db=${rec.ownerWallet})`)
      }
    } catch (e) {
      reasons.push(`chain-read-failed:${(e as Error).message.slice(0, 40)}`)
    }
  }

  const LE = Math.min(Math.floor((rec.runCount ?? 0) / 10), 10)
  const lo = 0 - LE, hi = 10 + LE
  const capacity = 4 * hi
  if (talents.length !== 3) reasons.push(`talents.len=${talents.length}`)
  if (allocArr.some((v) => !Number.isInteger(v) || v < lo || v > hi)) reasons.push(`alloc out of [${lo},${hi}]`)
  if (allocArr.reduce((s, v) => s + v, 0) > capacity) reasons.push(`alloc sum>${capacity}`)

  const s = mgr.create()
  try {
    const r = s.replay({ seed: rec.seed, runCount: rec.runCount ?? 0, finalTalentIds: talents, allocation: alloc })
    const sm = r.summary
    if (sm.fate_level !== rec.fateLevel) reasons.push(`fate(replay=${sm.fate_level},db=${rec.fateLevel})`)
    if (sm.sum !== rec.sum) reasons.push(`sum(replay=${sm.sum},db=${rec.sum})`)
    if (sm.HAGE !== rec.HAGE) reasons.push(`hage(replay=${sm.HAGE},db=${rec.HAGE})`)
    if (sm.myth_count !== rec.mythCount) reasons.push(`myth(replay=${sm.myth_count},db=${rec.mythCount})`)
  } catch (e) {
    reasons.push(`replay-failed:${(e as Error).message.slice(0, 40)}`)
  } finally {
    mgr.remove(s.id)
  }

  return reasons.length ? `mismatch:${reasons.join('; ')}` : 'verified'
}

async function scan(
  provider: JsonRpcProvider, mgr: SessionManager, nftRead: Contract | null,
  consumer: string, nftAddr: string, cIface: Interface, nIface: Interface, from: number, to: number,
): Promise<void> {
  const address = [consumer, nftAddr].filter((a): a is string => !!a)
  const logs = await fetchLogsAdaptive(provider, address, from, to)

  for (const log of logs) {
    const addr = log.address.toLowerCase()
    if (consumer && addr === consumer.toLowerCase()) {
      const p = safeParse(cIface, log)
      if (p?.name === 'SeedFulfilled') {
        await recordRandcastFulfilled({
          requestId: String(p.args.requestId), consumer, requester: String(p.args.requester),
          seed: Number(p.args.seed), randomness: String(p.args.randomness), fulfillTx: log.transactionHash, at: Date.now(),
        })
        console.log(`[monitor] SeedFulfilled req=${String(p.args.requestId).slice(0, 12)}… seed=${Number(p.args.seed)}`)
      }
    } else if (nftAddr && addr === nftAddr.toLowerCase()) {
      const p = safeParse(nIface, log)
      if (p?.name === 'InscriptionMinted') {
        const tokenId = String(p.args.tokenId)
        const owner = String(p.args.owner)
        const rec = await inscriptionByTokenId(tokenId)
        if (!rec) {
          console.warn(`[monitor][RECONCILE] external mint tokenId=${tokenId} not found in DB (skipping) owner=${owner}`)
          continue
        }
        const status = await verifyRecord(mgr, nftRead, rec)
        await setInscriptionVerifyStatus(rec.id, status)
        if (status === 'verified') console.log(`[monitor][RECONCILE] ✓ tokenId=${tokenId} verified`)
        else console.warn(`[monitor][RECONCILE] ✗ tokenId=${tokenId} ${status}`)
      }
    }
  }
}

async function main(): Promise<void> {
  const rpc = config.chain.rpcUrl
  const consumer = config.chain.consumer
  const nftAddr = config.chain.inscriptionNft
  if (!rpc || (!consumer && !nftAddr)) {
    console.error('[monitor] missing BSC_RPC_URL or contract address (RANDCAST_CONSUMER / INSCRIPTION_NFT), exiting')
    process.exit(1)
  }
  if (hasDb) {
    await pool!.query(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf-8'))
  } else {
    console.warn('[monitor] DATABASE_URL not configured: cursor/ledger/reconcile state is memory-only and will be lost on restart (recommend configuring a database)')
  }

  const svc: Services = {
    dataStore: new DataStore(config.dataDir, config.worldOrder),
    dataStoreEn: new DataStore(config.dataDirEn, config.worldOrder),
    ai: new MockAIService(),
    pollution: new PollutionService(config.pollutionCap),
  }
  const mgr = new SessionManager(svc)

  const provider = new JsonRpcProvider(rpc, config.chain.chainId, { batchMaxCount: 1 })
  const cIface = new Interface(CONSUMER_ABI)
  const nIface = new Interface(NFT_EVENT_ABI)
  const nftRead = nftAddr ? new Contract(nftAddr, NFT_READ_ABI, provider) : null

  const latest = await withRetry(() => provider.getBlockNumber(), 'getBlockNumber')
  const saved = await getMonitorState(CURSOR_KEY)
  let cursor = saved
    ? Number(saved)
    : (process.env.MONITOR_START_BLOCK ? Number(process.env.MONITOR_START_BLOCK) : Math.max(0, latest - CHUNK))
  console.log(`[monitor] starting chainId=${config.chain.chainId}, from block ${cursor} (latest ${latest}, confirmations ${CONFIRMATIONS})`)

  const tick = async (): Promise<void> => {
    try {
      const head = (await withRetry(() => provider.getBlockNumber(), 'getBlockNumber')) - CONFIRMATIONS
      while (cursor <= head) {
        const to = Math.min(cursor + effectiveChunk - 1, head)
        await scan(provider, mgr, nftRead, consumer, nftAddr, cIface, nIface, cursor, to)
        cursor = to + 1
        await setMonitorState(CURSOR_KEY, String(cursor))
      }
    } catch (e) {
      console.warn('[monitor] tick failed, retrying later:', (e as Error).message)
    } finally {
      setTimeout(() => void tick(), INTERVAL)
    }
  }
  void tick()
}

void main()
