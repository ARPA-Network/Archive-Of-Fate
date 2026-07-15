import { BrowserProvider, JsonRpcProvider, Contract, Interface, parseEther, type Eip1193Provider } from 'ethers'

const BSC_CHAIN_ID = Number(import.meta.env.VITE_BSC_CHAIN_ID ?? 56)
const BSC_HEX = '0x' + BSC_CHAIN_ID.toString(16)
const CONSUMER = (import.meta.env.VITE_CONSUMER_ADDRESS as string | undefined) ?? ''
const NFT = (import.meta.env.VITE_INSCRIPTION_NFT as string | undefined) ?? ''
const TOKEN = (import.meta.env.VITE_PROJECT_TOKEN as string | undefined) ?? ''
const RPC_URL = (import.meta.env.VITE_BSC_RPC as string | undefined) || 'https://bsc-dataseed.binance.org/'
const ZERO32 = '0x' + '0'.repeat(64)

const CONSUMER_ABI = [
  'function requestSeed() payable returns (bytes32)',
  'function getSeed(bytes32 requestId) view returns (uint256 seed, bool fulfilled)',
  'event SeedRequested(bytes32 indexed requestId, address indexed requester, bytes32 salt)',
]
const NFT_ABI = [
  'function currentMintFee() view returns (uint256)',
  'function mint(address to, string inscriptionId, uint256 seed, uint256[] talentIds, int256[4] allocation, bytes32 randcastRequestTx, uint256 deadline, bytes signature) returns (uint256)',
  'function getFate(uint256 tokenId) view returns (uint256 seed, uint256[] talentIds, int256[4] allocation, bytes32 randcastRequestTx)',
  'function ownerOf(uint256 tokenId) view returns (address)',
]
const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]

function eth(): Eip1193Provider {
  const e = (window as unknown as { ethereum?: Eip1193Provider }).ethereum
  if (!e) throw new Error('未检测到 MetaMask，请先安装/启用钱包')
  return e
}

export function hasWallet(): boolean {
  return !!(window as unknown as { ethereum?: unknown }).ethereum
}

type EthEvents = Eip1193Provider & {
  on?: (event: string, handler: (...a: unknown[]) => void) => void
}

let _watching = false
export function watchWallet(onChange: (reason: 'account' | 'chain') => void): void {
  const e = (window as unknown as { ethereum?: EthEvents }).ethereum
  if (!e || !e.on || _watching) return
  _watching = true
  e.on('accountsChanged', () => onChange('account'))
  e.on('chainChanged', () => onChange('chain'))
}

export function isConfigured(): boolean {
  return !!CONSUMER && !!NFT && !!TOKEN
}

export function isInscribeConfigured(): boolean {
  return !!NFT && !!TOKEN
}

export function isSeedConfigured(): boolean {
  return !!CONSUMER
}

async function ensureBsc(): Promise<void> {
  const provider = eth()
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BSC_HEX }] })
  } catch (e) {
    if ((e as { code?: number }).code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BSC_HEX,
            chainName: 'BNB Smart Chain',
            nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
            rpcUrls: ['https://bsc-dataseed.binance.org/'],
            blockExplorerUrls: ['https://bscscan.com'],
          },
        ],
      })
    } else {
      throw e
    }
  }
}

export async function connect(forcePicker = false): Promise<string> {
  const provider = eth()
  if (forcePicker) {
    try {
      await provider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] })
    } catch {
    }
  }
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
  await ensureBsc()
  return accounts[0]
}

async function signer() {
  const bp = new BrowserProvider(eth())
  return bp.getSigner()
}

async function feeOverrides(): Promise<{ gasPrice: bigint }> {
  const bp = new BrowserProvider(eth())
  const floor = 1_000_000_000n 
  let gp = floor
  try {
    const hex = (await bp.send('eth_gasPrice', [])) as string
    const v = BigInt(hex)
    if (v > floor) gp = v
  } catch {
  }
  return { gasPrice: gp }
}

export interface SeedResult {
  txHash: string
  requestId: string
  seed: number
}

export async function requestSeed(bnb: string): Promise<SeedResult> {
  if (!CONSUMER) throw new Error('未配置 VITE_CONSUMER_ADDRESS')
  const s = await signer()
  const consumer = new Contract(CONSUMER, CONSUMER_ABI, s)
  const tx = await consumer.requestSeed({ value: parseEther(bnb), ...(await feeOverrides()) })
  const receipt = await tx.wait()

  const iface = new Interface(CONSUMER_ABI)
  let requestId = ''
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log)
      if (parsed?.name === 'SeedRequested') {
        requestId = parsed.args.requestId as string
        break
      }
    } catch {
    }
  }
  if (!requestId) throw new Error('未能解析 requestId（SeedRequested 事件）')

  const seed = await waitForSeed(requestId)
  return { txHash: tx.hash, requestId, seed }
}

export async function waitForSeed(requestId: string, timeoutMs = 60_000): Promise<number> {
  const bp = new BrowserProvider(eth())
  const consumer = new Contract(CONSUMER, CONSUMER_ABI, bp)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const [seed, fulfilled] = (await consumer.getSeed(requestId)) as [bigint, boolean]
    if (fulfilled) return Number(seed)
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('随机数回调超时，请稍后重试')
}

export interface InscribeParams {
  to: string
  inscriptionId: string
  seed: number
  talentIds: number[]
  allocation: [number, number, number, number] 
  randcastRequestTx: string 
  deadline: number 
  signature: string 
}

export async function inscribe(p: InscribeParams): Promise<string> {
  if (!NFT || !TOKEN) throw new Error('未配置 NFT / TOKEN 地址')
  const s = await signer()
  const me = await s.getAddress()
  const nft = new Contract(NFT, NFT_ABI, s)
  const token = new Contract(TOKEN, ERC20_ABI, s)

  const fee = (await nft.currentMintFee()) as bigint
  if (fee > 0n) {
    const allowance = (await token.allowance(me, NFT)) as bigint
    if (allowance < fee) {
      const approveTx = await token.approve(NFT, fee, await feeOverrides())
      await approveTx.wait()
    }
  }

  const tx = await nft.mint(
    p.to,
    p.inscriptionId,
    BigInt(p.seed),
    p.talentIds.map((x) => BigInt(x)),
    p.allocation.map((x) => BigInt(x)),
    p.randcastRequestTx,
    BigInt(p.deadline),
    p.signature,
    await feeOverrides(),
  )
  const receipt = await tx.wait()
  return receipt.hash as string
}

export interface VerifyExpected {
  contract: string
  tokenId: string
  seed: number
  talentIds: number[]
  allocation: [number, number, number, number] 
  randcastRequestTx: string | null
  owner: string | null
}

export interface VerifyResult {
  ok: boolean
  checks: { seed: boolean; talents: boolean; allocation: boolean; randcast: boolean; owner: boolean }
  onchain: { seed: number; talentIds: number[]; allocation: number[]; randcastRequestTx: string; owner: string }
}

const eqArr = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])

export async function verifyInscription(e: VerifyExpected): Promise<VerifyResult> {
  const provider = new JsonRpcProvider(RPC_URL, BSC_CHAIN_ID)
  const nft = new Contract(e.contract, NFT_ABI, provider)
  const [fate, owner] = await Promise.all([nft.getFate(e.tokenId), nft.ownerOf(e.tokenId)])

  const seed = Number(fate.seed ?? fate[0])
  const talentIds = ((fate.talentIds ?? fate[1]) as bigint[]).map((x) => Number(x))
  const allocation = ((fate.allocation ?? fate[2]) as bigint[]).map((x) => Number(x))
  const rtx = String(fate.randcastRequestTx ?? fate[3]).toLowerCase()
  const ownerAddr = String(owner)

  const expRtx = (e.randcastRequestTx ? e.randcastRequestTx.toLowerCase() : ZERO32)
  const checks = {
    seed: seed === e.seed,
    talents: eqArr(talentIds, e.talentIds),
    allocation: eqArr(allocation, e.allocation),
    randcast: rtx === expRtx,
    owner: !!e.owner && ownerAddr.toLowerCase() === e.owner.toLowerCase(),
  }
  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    onchain: { seed, talentIds, allocation, randcastRequestTx: rtx, owner: ownerAddr },
  }
}
