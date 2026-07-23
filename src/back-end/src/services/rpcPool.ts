import { JsonRpcProvider } from 'ethers'

interface EndpointState {
  url: string
  provider: JsonRpcProvider
  healthy: boolean
  consecutiveFailures: number
  lastCheckedAt: number
  lastError: string | null
}

export interface RpcEndpointStatus {
  url: string
  healthy: boolean
  consecutiveFailures: number
  lastError: string | null
  lastCheckedAt: number
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}`
  } catch {
    return 'invalid-url'
  }
}

function errorMessage(e: unknown): string {
  const withInfo = e as { info?: { responseBody?: string }; shortMessage?: string; message?: string }
  return String(withInfo?.info?.responseBody ?? withInfo?.shortMessage ?? withInfo?.message ?? e)
}

function isEndpointDown(e: unknown): boolean {
  const msg = errorMessage(e).toLowerCase()
  if (msg.includes('block range')) return false
  const code = (e as { code?: string })?.code
  if (code === 'TIMEOUT' || code === 'NETWORK_ERROR' || code === 'SERVER_ERROR' || code === 'UNKNOWN_ERROR') return true
  return (
    msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('timeout') ||
    msg.includes('fetch failed') || msg.includes('rate limit') ||
    msg.includes('429') || msg.includes('401') || msg.includes('403')
  )
}

export class RpcPool {
  private endpoints: EndpointState[]
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(urls: string[], private chainId: number, private checkIntervalMs = 30000) {
    if (urls.length === 0) throw new Error('RpcPool needs at least one RPC URL')
    this.endpoints = urls.map((url) => ({
      url,
      provider: new JsonRpcProvider(url, chainId, { batchMaxCount: 1 }),
      healthy: true,
      consecutiveFailures: 0,
      lastCheckedAt: 0,
      lastError: null,
    }))
  }

  start(): this {
    void this.checkAll()
    this.timer = setInterval(() => void this.checkAll(), this.checkIntervalMs)
    return this
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async checkAll(): Promise<void> {
    await Promise.all(this.endpoints.map((ep) => this.checkOne(ep)))
  }

  private async checkOne(ep: EndpointState): Promise<void> {
    try {
      const chainIdHex = (await ep.provider.send('eth_chainId', [])) as string
      const blockNumber = await ep.provider.getBlockNumber()
      if (Number(chainIdHex) === this.chainId && blockNumber > 0) {
        if (!ep.healthy) console.log(`[rpc-pool] ${redactUrl(ep.url)} recovered`)
        ep.healthy = true
        ep.consecutiveFailures = 0
        ep.lastError = null
      } else {
        this.markUnhealthy(ep, `unexpected chainId=${chainIdHex} blockNumber=${blockNumber}`)
      }
    } catch (e) {
      this.markUnhealthy(ep, errorMessage(e))
    }
    ep.lastCheckedAt = Date.now()
  }

  private markUnhealthy(ep: EndpointState, reason: string): void {
    ep.consecutiveFailures++
    ep.lastError = reason
    if (ep.healthy) console.warn(`[rpc-pool] ${redactUrl(ep.url)} marked unhealthy: ${reason.slice(0, 200)}`)
    ep.healthy = false
  }

  private ordered(): EndpointState[] {
    return [...this.endpoints].sort((a, b) => Number(b.healthy) - Number(a.healthy))
  }

  get(): JsonRpcProvider {
    const healthy = this.endpoints.find((e) => e.healthy)
    if (!healthy) console.warn('[rpc-pool] no healthy endpoint, using first configured as last resort')
    return (healthy ?? this.endpoints[0]).provider
  }

  async run<T>(fn: (provider: JsonRpcProvider) => Promise<T>): Promise<T> {
    let lastErr: unknown
    for (const ep of this.ordered()) {
      try {
        const result = await fn(ep.provider)
        if (!ep.healthy) {
          console.log(`[rpc-pool] ${redactUrl(ep.url)} succeeded, marking healthy again`)
          ep.healthy = true
          ep.consecutiveFailures = 0
          ep.lastError = null
        }
        return result
      } catch (e) {
        lastErr = e
        if (!isEndpointDown(e)) throw e
        this.markUnhealthy(ep, errorMessage(e))
      }
    }
    throw lastErr
  }

  status(): RpcEndpointStatus[] {
    return this.endpoints.map((e) => ({
      url: redactUrl(e.url),
      healthy: e.healthy,
      consecutiveFailures: e.consecutiveFailures,
      lastError: e.lastError,
      lastCheckedAt: e.lastCheckedAt,
    }))
  }
}
