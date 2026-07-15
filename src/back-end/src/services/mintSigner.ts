import { Wallet, getBytes, type TypedDataDomain, type TypedDataField } from 'ethers'
import { config } from '../config'

const TYPES: Record<string, TypedDataField[]> = {
  Mint: [
    { name: 'to', type: 'address' },
    { name: 'inscriptionId', type: 'string' },
    { name: 'seed', type: 'uint256' },
    { name: 'talentIds', type: 'uint256[]' },
    { name: 'allocation', type: 'int256[4]' },
    { name: 'randcastRequestTx', type: 'bytes32' },
    { name: 'deadline', type: 'uint256' },
  ],
}

const ZERO_BYTES32 = '0x' + '0'.repeat(64)

export interface MintAuthInput {
  to: string
  inscriptionId: string
  seed: number
  talentIds: number[]
  allocation: { CHR: number; INT: number; STR: number; MNY: number }
  randcastRequestTx: string | null
}

export interface MintAuth {
  deadline: number
  signature: string
  randcastRequestTx: string 
}

export function mintSignerConfigured(): boolean {
  return !!config.chain.authorizerKey && !!config.chain.inscriptionNft
}

export function authorizerAddress(): string | null {
  if (!config.chain.authorizerKey) return null
  return new Wallet(config.chain.authorizerKey).address
}

export async function signMint(input: MintAuthInput): Promise<MintAuth> {
  if (!mintSignerConfigured()) throw new Error('mint signer not configured (missing AUTHORIZER_PRIVATE_KEY / INSCRIPTION_NFT)')
  const wallet = new Wallet(config.chain.authorizerKey)
  const deadline = Math.floor(Date.now() / 1000) + config.chain.authDeadlineSec

  const domain: TypedDataDomain = {
    name: 'ArchiveOfFate',
    version: '1',
    chainId: config.chain.chainId,
    verifyingContract: config.chain.inscriptionNft,
  }
  const randcastRequestTx = normalizeBytes32(input.randcastRequestTx)
  const value = {
    to: input.to,
    inscriptionId: input.inscriptionId,
    seed: BigInt(input.seed),
    talentIds: input.talentIds.map((x) => BigInt(x)),
    allocation: [
      BigInt(input.allocation.CHR),
      BigInt(input.allocation.INT),
      BigInt(input.allocation.STR),
      BigInt(input.allocation.MNY),
    ],
    randcastRequestTx,
    deadline: BigInt(deadline),
  }

  const signature = await wallet.signTypedData(domain, TYPES, value)
  return { deadline, signature, randcastRequestTx }
}

function normalizeBytes32(v: string | null): string {
  if (!v) return ZERO_BYTES32
  let h = v.toLowerCase()
  if (!h.startsWith('0x')) h = '0x' + h
  const hex = h.slice(2)
  if (hex.length === 64) return h
  try {
    getBytes(h) 
  } catch {
    return ZERO_BYTES32
  }
  return '0x' + hex.padStart(64, '0').slice(-64)
}
