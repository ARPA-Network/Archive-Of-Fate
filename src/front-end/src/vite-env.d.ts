/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_GITHUB_URL?: string
  readonly VITE_TELEGRAM_URL?: string
  readonly VITE_BSC_CHAIN_ID?: string
  readonly VITE_BSC_RPC?: string
  readonly VITE_CONSUMER_ADDRESS?: string
  readonly VITE_INSCRIPTION_NFT?: string
  readonly VITE_PROJECT_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
