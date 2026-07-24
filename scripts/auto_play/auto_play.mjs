import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout, argv, env, exit } from 'node:process'
import { JsonRpcProvider, Wallet, Contract, Interface, isAddress, parseEther, formatEther } from 'ethers'

const HERE = path.dirname(fileURLToPath(import.meta.url))

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const l = line.trim()
    if (!l || l.startsWith('#') || !l.includes('=')) continue
    const i = l.indexOf('=')
    const k = l.slice(0, i).trim()
    const v = l.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (env[k] === undefined) env[k] = v
  }
}
loadEnvFile(path.join(HERE, '.env'))

function arg(name) {
  const flag = `--${name}`
  const idx = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`))
  if (idx === -1) return undefined
  const a = argv[idx]
  if (a.includes('=')) return a.slice(a.indexOf('=') + 1)
  return argv[idx + 1]
}

const API_BASE = (arg('api') || env.API_BASE || 'http://localhost:8787').replace(/\/+$/, '')
const RPC_URL = arg('rpc') || env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/'
const CHAIN_ID = Number(arg('chain-id') || env.BSC_CHAIN_ID || 56)
const CONSUMER = arg('consumer') || env.CONSUMER_ADDRESS || ''
const NFT = arg('nft') || env.INSCRIPTION_NFT || ''
const TOKEN = arg('token') || env.PROJECT_TOKEN || ''
const SEED_COST_BNB_DEFAULT = arg('seed-cost') || env.SEED_COST_BNB || '0.0001'
const LANGUAGE = arg('language') || env.LANGUAGE || 'zh-cn'
const USERNAME = arg('username') || env.AOF_CHARACTER_NAME || null
const ROUND_DELAY_MS = Number(arg('delay') || env.ROUND_DELAY_MS || 3000)
const SEED_TIMEOUT_MS = Number(arg('seed-timeout') || env.SEED_TIMEOUT_MS || 240_000)
const AUTO_YES = argv.includes('--yes')

const CONSUMER_ABI = [
  'function requestSeed() payable returns (bytes32)',
  'function getSeed(bytes32 requestId) view returns (uint256 seed, bool fulfilled)',
  'event SeedRequested(bytes32 indexed requestId, address indexed requester, bytes32 salt)',
]
const NFT_ABI = [
  'function currentMintFee() view returns (uint256)',
  'function mint(address to, string inscriptionId, uint256 seed, uint256[] talentIds, int256[4] allocation, bytes32 randcastRequestTx, uint256 deadline, bytes signature) returns (uint256)',
]
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function feeOverrides(provider) {
  const floor = 1_000_000_000n
  let gasPrice = floor
  try {
    const hex = await provider.send('eth_gasPrice', [])
    const v = BigInt(hex)
    if (v > floor) gasPrice = v
  } catch {
  }
  return { gasPrice }
}

async function apiCall(method, urlPath, body) {
  const res = await fetch(API_BASE + urlPath, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${urlPath} -> ${json.error ?? res.status}(${json.code ?? res.status}) ${json.message ?? ''}`)
  return json
}
const apiGet = (p) => apiCall('GET', p)
const apiPost = (p, body) => apiCall('POST', p, body)

async function pollGameReady(sessionId, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const r = await apiGet(`/game/${sessionId}`)
    if (r.status === 'ready') return r
    await sleep(1500)
  }
  throw new Error('Timeout waiting for game seed')
}

async function waitForSeedFulfilled(provider, requestId, timeoutMs = SEED_TIMEOUT_MS) {
  const consumer = new Contract(CONSUMER, CONSUMER_ABI, provider)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const [seed, fulfilled] = await consumer.getSeed(requestId)
    if (fulfilled) return Number(seed)
    await sleep(2000)
  }
  throw new Error(`Timeout waiting for Randcast random number callback (requestId=${requestId}); BNB was already paid and the request may still fulfill later, check getSeed(${requestId}) on the consumer contract`)
}

async function requestSeedOnChainAndSubmit(wallet, provider, sessionId, seedCostBnb) {
  const consumer = new Contract(CONSUMER, CONSUMER_ABI, wallet)
  console.log(`  Calling requestSeed() paying ${seedCostBnb} BNB ...`)
  const tx = await consumer.requestSeed({ value: parseEther(String(seedCostBnb)), ...(await feeOverrides(provider)) })
  console.log(`  Transaction sent ${tx.hash}, waiting for confirmation...`)
  const receipt = await tx.wait()

  const iface = new Interface(CONSUMER_ABI)
  let requestId = ''
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== CONSUMER.toLowerCase()) continue
    try {
      const parsed = iface.parseLog(log)
      if (parsed?.name === 'SeedRequested') {
        requestId = parsed.args.requestId
        break
      }
    } catch {
    }
  }
  if (!requestId) throw new Error('Failed to parse requestId from receipt (SeedRequested event)')

  console.log(`  requestId=${requestId}, waiting for random number callback...`)
  const seed = await waitForSeedFulfilled(provider, requestId)
  console.log(`  Got on-chain seed ${seed}`)

  return apiPost(`/game/${sessionId}/seed`, { request_id: requestId, seed, request_tx: tx.hash })
}

function pickTalents(pool, count) {
  const sorted = [...pool].sort((a, b) => b.grade - a.grade)
  const picked = []
  const conflicts = (t) => picked.some((p) => (t.exclude ?? []).includes(p.id) || (p.exclude ?? []).includes(t.id))
  for (const t of sorted) {
    if (picked.length >= count) break
    if (!conflicts(t)) picked.push(t)
  }
  for (const t of sorted) {
    if (picked.length >= count) break
    if (!picked.includes(t)) picked.push(t)
  }
  return picked.slice(0, count).map((t) => t.id)
}

function allocateProperties([lo, hi], budget) {
  const keys = ['CHR', 'INT', 'STR', 'MNY']
  const alloc = {}
  for (const k of keys) alloc[k] = lo
  let remaining = Math.max(0, budget - lo * keys.length)
  let progress = true
  while (remaining > 0 && progress) {
    progress = false
    for (const k of keys) {
      if (remaining <= 0) break
      if (alloc[k] < hi) {
        alloc[k] += 1
        remaining -= 1
        progress = true
      }
    }
  }
  return alloc
}

async function playWithAllocationRetry(sessionId, talentIds, propertyLimits, budget) {
  let allocation = allocateProperties(propertyLimits, budget)
  try {
    const playResp = await apiPost(`/game/${sessionId}/play`, { talent_ids: talentIds, allocation })
    return { playResp, allocation }
  } catch (e) {
    const m = /must not exceed (\d+)/.exec(e.message)
    if (!m) throw e
    console.warn(`  Allocation exceeded real post-talent budget, retrying with corrected budget=${m[1]}`)
    allocation = allocateProperties(propertyLimits, Number(m[1]))
    const playResp = await apiPost(`/game/${sessionId}/play`, { talent_ids: talentIds, allocation })
    return { playResp, allocation }
  }
}

async function inscribeRound(wallet, sessionId) {
  const prep = await apiPost(`/game/${sessionId}/inscribe/prepare`, { wallet_address: wallet.address })
  let txHash
  if (prep.signature && prep.allocation) {
    const nft = new Contract(NFT, NFT_ABI, wallet)
    const token = new Contract(TOKEN, ERC20_ABI, wallet)
    const fee = await nft.currentMintFee()
    if (fee > 0n) {
      const allowance = await token.allowance(wallet.address, NFT)
      if (allowance < fee) {
        console.log(`  Approving ${formatEther(fee)} project tokens for minting contract...`)
        const approveTx = await token.approve(NFT, fee, await feeOverrides(wallet.provider))
        await approveTx.wait()
      }
    }
    console.log('  Calling mint() to mint inscription NFT ...')
    const mintTx = await nft.mint(
      wallet.address,
      prep.inscription_id,
      BigInt(prep.seed),
      prep.talent_ids.map((x) => BigInt(x)),
      [prep.allocation.CHR, prep.allocation.INT, prep.allocation.STR, prep.allocation.MNY].map((x) => BigInt(x)),
      prep.randcast_request_tx,
      BigInt(prep.deadline),
      prep.signature,
      await feeOverrides(wallet.provider),
    )
    const receipt = await mintTx.wait()
    txHash = receipt.hash
  } else {
    console.warn('  Backend not configured with inscription signature (AUTHORIZER_PRIVATE_KEY), skipping real on-chain mint, recording placeholder transaction only')
    txHash = '0x' + '0'.repeat(64)
  }
  const result = await apiPost(`/game/${sessionId}/inscribe`, { tx_hash: txHash, display_name: USERNAME })
  console.log(`  Inscription complete tokenId=${result.entry?.nft?.token_id ?? '?'} tx=${txHash}`)
}

async function playOneRound(wallet, provider, seedCostBnb, inscribeEach) {
  const playerId = `wallet_${wallet.address.toLowerCase()}`
  const newResp = await apiPost('/game/new', {
    language: LANGUAGE,
    wallet_address: wallet.address,
    run_count: 0,
    username: USERNAME,
    player_id: playerId,
  })
  const sessionId = newResp.session_id

  let ready
  if (newResp.status === 'awaiting_seed') {
    ready = await requestSeedOnChainAndSubmit(wallet, provider, sessionId, newResp.seed_cost_bnb || seedCostBnb)
  } else if (newResp.status === 'awaiting_seed_tx') {
    await apiPost(`/game/${sessionId}/seed_sent`, { tx_hash: '0x' + '0'.repeat(64) }).catch(() => {})
    ready = await pollGameReady(sessionId)
  } else if (newResp.status === 'pending_seed') {
    ready = await pollGameReady(sessionId)
  } else {
    throw new Error(`Unknown game start status ${newResp.status}`)
  }

  const talentIds = pickTalents(ready.talent_pool, 3)
  const { playResp, allocation } = await playWithAllocationRetry(sessionId, talentIds, ready.property_limits, ready.spendable_points)

  const s = playResp.summary
  console.log(`  ${s.character_name} (${ready.world}) fate=${s.fate_level} sum=${s.sum} age=${s.HAGE} myth_count=${s.myth_count}`)
  console.log(`  talents=${playResp.final_talent_ids.join(',')} attributes=CHR${allocation.CHR}/INT${allocation.INT}/STR${allocation.STR}/MNY${allocation.MNY}`)

  if (inscribeEach) await inscribeRound(wallet, sessionId)
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout })
  const ask = (q) => rl.question(q)

  let privateKey = arg('private-key') || env.WALLET_PRIVATE_KEY
  if (!privateKey) privateKey = await ask('Please enter wallet private key (0x prefix, only stored in local memory): ')
  privateKey = privateKey.trim()
  if (!privateKey.startsWith('0x')) privateKey = '0x' + privateKey

  let roundsRaw = arg('rounds') || env.ROUNDS
  if (!roundsRaw) roundsRaw = await ask('How many rounds to auto-play?: ')
  const rounds = Math.floor(Number(roundsRaw))
  if (!Number.isFinite(rounds) || rounds <= 0) throw new Error('Number of rounds must be a positive integer')

  let inscribeRaw = arg('inscribe') ?? env.INSCRIBE
  if (inscribeRaw === undefined) inscribeRaw = await ask('Auto-inscribe after each round (costs 50 project tokens + gas)? (y/N): ')
  const inscribeEach = /^y(es)?$/i.test(String(inscribeRaw).trim())

  if (!isAddress(CONSUMER)) throw new Error('CONSUMER_ADDRESS not configured or not a valid address')
  if (inscribeEach && (!isAddress(NFT) || !isAddress(TOKEN))) throw new Error('Inscription requires INSCRIPTION_NFT and PROJECT_TOKEN to be configured')

  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
  const wallet = new Wallet(privateKey, provider)
  privateKey = null

  console.log(`Wallet address: ${wallet.address}`)
  const bnbBal = await provider.getBalance(wallet.address)
  console.log(`BNB balance: ${formatEther(bnbBal)}`)
  if (inscribeEach) {
    const token = new Contract(TOKEN, ERC20_ABI, provider)
    const tokenBal = await token.balanceOf(wallet.address)
    console.log(`Project token balance: ${formatEther(tokenBal)}`)
  }
  console.log(`Planning to auto-play ${rounds} rounds, each round costs approximately ${SEED_COST_BNB_DEFAULT} BNB for seeding${inscribeEach ? ', plus 50 project tokens + gas for inscription per round' : ''}.`)
  console.log('All transactions are on real BSC mainnet and irreversible once sent.')

  if (!AUTO_YES) {
    const confirm = await ask('Confirm to start? Type yes to continue: ')
    if (confirm.trim().toLowerCase() !== 'yes') {
      console.log('Cancelled.')
      rl.close()
      return
    }
  }
  rl.close()

  for (let i = 1; i <= rounds; i++) {
    console.log(`\n===== Round ${i}/${rounds} =====`)
    try {
      await playOneRound(wallet, provider, SEED_COST_BNB_DEFAULT, inscribeEach)
    } catch (e) {
      console.error(`  Round ${i} failed: ${e.message}`)
    }
    if (i < rounds) await sleep(ROUND_DELAY_MS)
  }
  console.log('\nAll done.')
}

main().catch((e) => {
  console.error('Script terminated:', e.message)
  exit(1)
})