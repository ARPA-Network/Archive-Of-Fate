import type { CondCtx } from './condition'
import type { PropertySnapshot } from '../types'

const CORE_KEYS = ['CHR', 'INT', 'STR', 'MNY', 'SPR'] as const
const RDM_TARGETS = ['CHR', 'INT', 'STR', 'MNY', 'SPR'] as const

export class PropertyState implements CondCtx {
  AGE = -1
  CHR = 0
  INT = 0
  STR = 0
  MNY = 0
  SPR = 5
  LIF = 1
  TLT: number[] = []
  EVT: number[] = []

  private hi: Record<string, number> = {}
  private lo: Record<string, number> = {}
  private extra: Record<string, number> = {}

  restart(): void {
    this.AGE = -1
    this.CHR = 0
    this.INT = 0
    this.STR = 0
    this.MNY = 0
    this.SPR = 5
    this.LIF = 1
    this.TLT = []
    this.EVT = []
    this.hi = {}
    this.lo = {}
    const tms = this.extra.TMS || 0
    this.extra = { TMS: tms, MYTHC: 0 }
    this.syncHistory()
  }

  setTMS(v: number): void {
    this.extra.TMS = v
  }

  change(prop: string, delta: number): void {
    if (prop === 'MYTHC') {
      this.extra.MYTHC = (this.extra.MYTHC || 0) + 1 
      return
    }
    if (prop === 'TLT' || prop === 'EVT') {
      const arr = prop === 'TLT' ? this.TLT : this.EVT
      if (delta >= 0) {
        if (!arr.includes(delta)) arr.push(delta)
      } else {
        const idx = arr.indexOf(-delta)
        if (idx >= 0) arr.splice(idx, 1)
      }
      return
    }
    if (this.isCore(prop) || prop === 'AGE' || prop === 'LIF') {
      ;(this as unknown as Record<string, number>)[prop] += delta
      this.syncHistory()
      return
    }
    this.extra[prop] = (this.extra[prop] || 0) + delta
  }

  set(prop: string, value: number): void {
    if (prop === 'AGE' || prop === 'LIF' || this.isCore(prop)) {
      ;(this as unknown as Record<string, number>)[prop] = value
      this.syncHistory()
    } else {
      this.extra[prop] = value
    }
  }

  effect(map?: Record<string, number> | null): void {
    if (!map) return
    for (const [k, v] of Object.entries(map)) {
      const key = k.toUpperCase()
      if (key === 'RDM') {
        const target = RDM_TARGETS[Math.floor(Math.random() * RDM_TARGETS.length)]
        this.change(target, v)
      } else {
        this.change(key, v)
      }
    }
  }

  private syncHistory(): void {
    for (const k of CORE_KEYS) {
      const v = (this as unknown as Record<string, number>)[k]
      this.hi[k] = this.hi[k] === undefined ? v : Math.max(this.hi[k], v)
      this.lo[k] = this.lo[k] === undefined ? v : Math.min(this.lo[k], v)
    }
    this.hi.AGE = this.hi.AGE === undefined ? this.AGE : Math.max(this.hi.AGE, this.AGE)
    this.lo.AGE = this.lo.AGE === undefined ? this.AGE : Math.min(this.lo.AGE, this.AGE)
  }

  private isCore(prop: string): boolean {
    return (CORE_KEYS as readonly string[]).includes(prop)
  }

  get SUM(): number {
    const h = (k: string) => this.num('H' + k)
    return Math.floor((h('CHR') + h('INT') + h('STR') + h('MNY') + h('SPR')) * 2 + this.num('HAGE') / 2)
  }

  num(prop: string): number {
    switch (prop) {
      case 'AGE': return this.AGE
      case 'CHR': return this.CHR
      case 'INT': return this.INT
      case 'STR': return this.STR
      case 'MNY': return this.MNY
      case 'SPR': return this.SPR
      case 'LIF': return this.LIF
      case 'SUM': return this.SUM
    }
    if (prop[0] === 'H' && this.isCoreOrAge(prop.slice(1))) {
      const base = prop.slice(1)
      const cur = base === 'AGE' ? this.AGE : (this as unknown as Record<string, number>)[base]
      return Math.max(this.hi[base] ?? cur, cur)
    }
    if (prop[0] === 'L' && this.isCoreOrAge(prop.slice(1))) {
      const base = prop.slice(1)
      const cur = base === 'AGE' ? this.AGE : (this as unknown as Record<string, number>)[base]
      return Math.min(this.lo[base] ?? cur, cur)
    }
    return this.extra[prop] ?? 0
  }

  arr(prop: string): number[] {
    if (prop === 'TLT') return this.TLT
    if (prop === 'EVT') return this.EVT
    return []
  }

  private isCoreOrAge(prop: string): boolean {
    return prop === 'AGE' || this.isCore(prop)
  }

  snapshot(): PropertySnapshot {
    return { CHR: this.CHR, INT: this.INT, STR: this.STR, MNY: this.MNY, SPR: this.SPR }
  }
}
