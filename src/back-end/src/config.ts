import path from 'path'

const BACKEND_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(BACKEND_ROOT, '../..') 

function resolveDataDir(): string {
  if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
    return path.resolve(process.env.DATA_DIR.trim())
  }
  return path.resolve(REPO_ROOT, 'game-data/zh')
}

function resolveDataDirEn(): string {
  if (process.env.DATA_DIR_EN && process.env.DATA_DIR_EN.trim()) {
    return path.resolve(process.env.DATA_DIR_EN.trim())
  }
  return path.resolve(REPO_ROOT, 'game-data/en')
}

function resolveRpcUrls(): string[] {
  const list = process.env.BSC_RPC_URLS || process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/'
  const urls = list.split(',').map((s) => s.trim()).filter(Boolean)
  return urls.length > 0 ? urls : ['https://bsc-dataseed.binance.org/']
}

export const config = {
  port: Number(process.env.PORT || 8787),
  dataDir: resolveDataDir(),
  dataDirEn: resolveDataDirEn(),
  worldOrder: ['zh-cn', 'zh-cn-wf', 'zh-cn-cf'] as const,
  language: 'zh-cn',
  pollutionCap: 500, 
  sessionTtlMs: 30 * 60 * 1000, 
  corsOrigin: process.env.CORS_ORIGIN || '*',
  anonGameLimit: Number(process.env.ANON_GAME_LIMIT || 10),

  databaseUrl: process.env.DATABASE_URL || null,

  ai: {
    apiKey: process.env.ANTHROPIC_API_KEY || null,
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 8000),
  },

  chain: {
    chainId: Number(process.env.BSC_CHAIN_ID || 56),
    inscriptionNft: process.env.INSCRIPTION_NFT || '',
    authorizerKey: process.env.AUTHORIZER_PRIVATE_KEY || '',
    authDeadlineSec: Number(process.env.AUTH_DEADLINE_SEC || 600), 
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
    rpcUrls: resolveRpcUrls(),
    consumer: process.env.RANDCAST_CONSUMER || '',
    seedCostBnb: process.env.SEED_COST_BNB || '0.0001',
    operatorKey: process.env.OPERATOR_PRIVATE_KEY || '',
  },

  nft: {
    imageBase: process.env.NFT_IMAGE_BASE || '',
    defaultImage: process.env.NFT_DEFAULT_IMAGE || '',
    externalBase: process.env.NFT_EXTERNAL_BASE || '',
  },
}

export type WorldFolder = (typeof config.worldOrder)[number]
