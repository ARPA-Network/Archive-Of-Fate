import { JsonRpcProvider, Interface, Contract, Wallet, id as keccakId } from 'ethers'
import { config } from '../config'

const NFT_EVENT_ABI = [
  'event InscriptionMinted(uint256 indexed tokenId, address indexed owner, string inscriptionId, uint256 seed, bytes32 randcastRequestTx, uint256 paidToken)',
]

const CONSUMER_ABI = [
  'function getSeed(bytes32 requestId) view returns (uint256 seed, bool fulfilled)',
  'function requesters(bytes32) view returns (address)',
  'function requestSeedFor(bytes32 gameSessionId) returns (bytes32)',
  'event SeedRequested(bytes32 indexed requestId, address indexed requester, bytes32 salt)',
]

export function chainVerifyConfigured(): boolean {
  return !!config.chain.inscriptionNft && !!config.chain.rpcUrl
}

export interface VerifiedMint {
  tokenId: string
  contract: string
  owner: string
  inscriptionId: string
  seed: number
  randcastRequestTx: string
}

export interface ExpectedMint {
  inscriptionId: string
  owner: string
  seed: number
}

let _provider: JsonRpcProvider | null = null
function provider(): JsonRpcProvider {
  if (!_provider) _provider = new JsonRpcProvider(config.chain.rpcUrl, config.chain.chainId)
  return _provider
}

export async function verifyMint(txHash: string, expected: ExpectedMint): Promise<VerifiedMint> {
  const nft = config.chain.inscriptionNft.toLowerCase()
  const receipt = await provider().getTransactionReceipt(txHash)
  if (!receipt) throw new Error('Transaction not found or not yet confirmed')
  if (receipt.status !== 1) throw new Error('Transaction did not succeed (status != 1)')
  if ((receipt.to ?? '').toLowerCase() !== nft) throw new Error('Transaction target is not the inscription contract')

  const iface = new Interface(NFT_EVENT_ABI)
  let found: VerifiedMint | null = null
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== nft) continue
    let parsed
    try {
      parsed = iface.parseLog({ topics: [...log.topics], data: log.data })
    } catch {
      continue 
    }
    if (parsed?.name === 'InscriptionMinted') {
      found = {
        tokenId: parsed.args.tokenId.toString(),
        contract: config.chain.inscriptionNft,
        owner: String(parsed.args.owner),
        inscriptionId: String(parsed.args.inscriptionId),
        seed: Number(parsed.args.seed),
        randcastRequestTx: String(parsed.args.randcastRequestTx),
      }
      break
    }
  }
  if (!found) throw new Error('InscriptionMinted event not found in receipt')

  if (found.inscriptionId !== expected.inscriptionId) {
    throw new Error(`inscriptionId mismatch (on-chain ${found.inscriptionId} != session ${expected.inscriptionId})`)
  }
  if (found.owner.toLowerCase() !== expected.owner.toLowerCase()) {
    throw new Error('owner does not match this session\'s wallet')
  }
  if (found.seed !== expected.seed) {
    throw new Error(`seed mismatch (on-chain ${found.seed} != session ${expected.seed})`)
  }
  return found
}

export function seedVerifyConfigured(): boolean {
  return !!config.chain.consumer && !!config.chain.rpcUrl
}

export async function verifySeed(requestId: string, seed: number, expectedRequester?: string): Promise<void> {
  const consumer = new Contract(config.chain.consumer, CONSUMER_ABI, provider())
  const [onchainSeed, fulfilled] = (await consumer.getSeed(requestId)) as [bigint, boolean]
  if (!fulfilled) throw new Error('Randomness not yet fulfilled')
  if (Number(onchainSeed) !== seed) throw new Error(`seed does not match on-chain value (on-chain ${onchainSeed})`)
  if (expectedRequester) {
    const r = (await consumer.requesters(requestId)) as string
    if (r.toLowerCase() !== expectedRequester.toLowerCase()) throw new Error('Randomness requester does not match this session\'s wallet')
  }
}

export function operatorConfigured(): boolean {
  return !!config.chain.consumer && !!config.chain.rpcUrl && !!config.chain.operatorKey
}

export async function requestSeedForSession(sessionId: string): Promise<{ requestId: string; txHash: string }> {
  const wallet = new Wallet(config.chain.operatorKey, provider())
  const consumer = new Contract(config.chain.consumer, CONSUMER_ABI, wallet)
  const gameSessionId = keccakId(sessionId) 
  const tx = await consumer.requestSeedFor(gameSessionId, { gasLimit: 600000n })
  const receipt = await tx.wait()

  const iface = new Interface(CONSUMER_ABI)
  let requestId = ''
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== config.chain.consumer.toLowerCase()) continue
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data })
      if (parsed?.name === 'SeedRequested') {
        requestId = String(parsed.args.requestId)
        break
      }
    } catch {
      continue
    }
  }
  if (!requestId) throw new Error('Could not resolve requestId (SeedRequested event)')
  return { requestId, txHash: tx.hash }
}

export async function readSeed(requestId: string): Promise<{ seed: number; fulfilled: boolean }> {
  const consumer = new Contract(config.chain.consumer, CONSUMER_ABI, provider())
  const [seed, fulfilled] = (await consumer.getSeed(requestId)) as [bigint, boolean]
  return { seed: Number(seed), fulfilled: Boolean(fulfilled) }
}
