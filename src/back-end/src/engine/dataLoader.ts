import fs from 'fs'
import path from 'path'
import { compile, validate, type Cond } from './condition'
import type { Grade } from '../types'

const WORLD_LABEL: Record<string, string> = {
  'zh-cn': '现实',
  'zh-cn-cf': '玄幻',
  'zh-cn-wf': '异域',
}

const EFFECT_KEYS = new Set(['CHR', 'INT', 'STR', 'MNY', 'SPR', 'LIF', 'RDM'])
const WEIGHT_SAFE_MAX = 1e15

export interface AgeEntry {
  id: number
  weight: number
}
export interface AgeNode {
  age: number
  events: AgeEntry[]
  talents: number[]
}
export interface EventDef {
  id: number
  event: string
  grade: Grade
  effect?: Record<string, number>
  postEvent?: string
  include?: string
  exclude?: string
  NoRandom?: 0 | 1
  branch?: string[]
  _include: Cond
  _exclude: Cond
  _branch: Array<{ cond: Cond; next: number }>
}
export interface TalentDef {
  id: number
  name: string
  description: string
  grade: Grade
  effect?: Record<string, number>
  condition?: string
  exclude?: number[]
  status?: number
  exclusive?: 0 | 1
  replacement?: { grade?: number[]; talent?: Array<string | number> }
  _condition: Cond
  maxTriggers: number
}
export interface MythDef {
  id: string
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
  grade: Grade
  effect?: Record<string, number>
  fallback?: string
  description?: string
  pollution_type?: boolean
}
export interface WorldData {
  folder: string
  label: string
  worldText: string
  maxAge: number
  ages: Map<number, AgeNode>
  events: Map<number, EventDef>
  talents: Map<number, TalentDef>
  talentList: TalentDef[]
  myths: MythDef[]
  names: string[]
  initialName: string
}

let warnCount = 0
function warn(msg: string): void {
  warnCount++
  if (warnCount <= 100) console.warn(`[dataLoader] ${msg}`)
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
  } catch (e) {
    warn(`failed to parse ${file}: ${(e as Error).message}`)
    return fallback
  }
}

function parseWeightEntry(entry: string | number): AgeEntry {
  if (typeof entry === 'number') return { id: entry, weight: 1 }
  const [idStr, wStr] = String(entry).split('*')
  return { id: Number(idStr), weight: wStr ? Number(wStr) : 1 }
}

function normGrade(g: unknown): Grade {
  const n = Number(g)
  return (n === 1 || n === 2 || n === 3 ? n : 0) as Grade
}

function calcMaxTriggers(condition?: string): number {
  if (!condition) return 1
  const m = condition.match(/AGE\s+IN\s*\(([^)]+)\)|AGE\?\[([^\]]+)\]/)
  if (m) {
    const inner = m[1] ?? m[2] ?? ''
    return inner.split(',').filter((x) => x.trim()).length || 1
  }
  return 1
}

function checkEffect(effect: Record<string, number> | undefined, where: string): void {
  if (!effect) return
  for (const k of Object.keys(effect)) {
    if (!EFFECT_KEYS.has(k.toUpperCase())) warn(`${where}: effect contains illegal key ${k}`)
  }
}

export function loadWorld(dataDir: string, folder: string): WorldData | null {
  const dir = path.join(dataDir, folder)
  if (!fs.existsSync(dir)) {
    warn(`world directory does not exist, skipping: ${dir}`)
    return null
  }

  const rawEvents = readJson<Record<string, any>>(path.join(dir, 'events.json'), {})
  const events = new Map<number, EventDef>()
  for (const [key, e] of Object.entries(rawEvents)) {
    const id = Number(e.id ?? key)
    if (e.include && !validate(e.include).valid) warn(`event ${id}: include invalid "${e.include}"`)
    if (e.exclude && !validate(e.exclude).valid) warn(`event ${id}: exclude invalid "${e.exclude}"`)
    checkEffect(e.effect, `event ${id}`)
    const branchAst: Array<{ cond: Cond; next: number }> = []
    if (Array.isArray(e.branch)) {
      for (const b of e.branch) {
        const m = /^(.*):(\d+)$/.exec(String(b))
        if (!m) {
          warn(`event ${id}: malformed branch "${b}"`)
          continue
        }
        branchAst.push({ cond: compile(m[1]), next: Number(m[2]) })
      }
    }
    events.set(id, {
      id,
      event: String(e.event ?? ''),
      grade: normGrade(e.grade),
      effect: e.effect,
      postEvent: e.postEvent,
      include: e.include,
      exclude: e.exclude,
      NoRandom: e.NoRandom,
      branch: e.branch,
      _include: compile(e.include),
      _exclude: compile(e.exclude),
      _branch: branchAst,
    })
  }
  for (const e of events.values()) {
    for (const b of e._branch) {
      if (!events.has(b.next)) warn(`event ${e.id}: branch target ${b.next} does not exist`)
    }
  }

  const rawTalents = readJson<Record<string, any>>(path.join(dir, 'talents.json'), {})
  const talents = new Map<number, TalentDef>()
  for (const [key, t] of Object.entries(rawTalents)) {
    const id = Number(t.id ?? key)
    if (t.condition && !validate(t.condition).valid) warn(`talent ${id}: condition invalid "${t.condition}"`)
    checkEffect(t.effect, `talent ${id}`)
    const exclude = Array.isArray(t.exclude) ? t.exclude.map((x: unknown) => Number(x)) : undefined
    talents.set(id, {
      id,
      name: String(t.name ?? ''),
      description: String(t.description ?? ''),
      grade: normGrade(t.grade),
      effect: t.effect,
      condition: t.condition,
      exclude,
      status: typeof t.status === 'number' ? t.status : undefined,
      exclusive: t.exclusive === 1 ? 1 : undefined,
      replacement: t.replacement,
      _condition: compile(t.condition),
      maxTriggers: calcMaxTriggers(t.condition),
    })
  }
  for (const t of talents.values()) {
    for (const ex of t.exclude ?? []) {
      if (!talents.has(ex)) warn(`talent ${t.id}: exclusive target ${ex} does not exist`)
    }
  }

  const rawAge = readJson<Record<string, any>>(path.join(dir, 'age.json'), {})
  const ages = new Map<number, AgeNode>()
  for (const [key, node] of Object.entries(rawAge)) {
    const age = Number(node.age ?? key)
    const entries: AgeEntry[] = Array.isArray(node.event) ? node.event.map(parseWeightEntry) : []
    const maxW = entries.reduce((mx, e) => Math.max(mx, e.weight), 0)
    if (maxW > WEIGHT_SAFE_MAX) {
      for (const e of entries) e.weight /= maxW
    }
    for (const e of entries) {
      if (!events.has(e.id)) warn(`age ${age}: event ${e.id} does not exist in EventStore`)
    }
    const tlist: number[] = Array.isArray(node.talent) ? node.talent.map((x: unknown) => Number(x)) : []
    for (const tid of tlist) {
      if (!talents.has(tid)) warn(`age ${age}: talent ${tid} does not exist in TalentStore`)
    }
    ages.set(age, { age, events: entries, talents: tlist })
  }

  const rawMyths = readJson<any[]>(path.join(dir, 'myth_events.json'), [])
  const myths: MythDef[] = (Array.isArray(rawMyths) ? rawMyths : []).map((m, i) => {
    checkEffect(m.effect, `myth ${m.id ?? i}`)
    const rarity = ['common', 'uncommon', 'rare', 'legendary'].includes(m.rarity) ? m.rarity : 'common'
    return {
      id: String(m.id ?? `myth_${folder}_${i + 1}`),
      rarity,
      grade: normGrade(m.grade ?? 3),
      effect: m.effect,
      fallback: m.fallback,
      description: m.description,
      pollution_type: m.pollution_type,
    }
  })

  const rawChar = readJson<any>(path.join(dir, 'character.json'), { initialName: '无名氏', names: [] })
  const names: string[] = Array.isArray(rawChar.names) ? rawChar.names.map((n: unknown) => String(n)) : []

  const worldTxtPath = path.join(dir, 'world.txt')
  const worldText = fs.existsSync(worldTxtPath) ? fs.readFileSync(worldTxtPath, 'utf-8') : ''

  const maxAge = ages.size > 0 ? Math.max(...ages.keys()) : 100

  return {
    folder,
    label: WORLD_LABEL[folder] ?? folder,
    worldText,
    maxAge,
    ages,
    events,
    talents,
    talentList: [...talents.values()],
    myths,
    names,
    initialName: String(rawChar.initialName ?? '无名氏'),
  }
}

export class DataStore {
  private worlds = new Map<string, WorldData>()

  constructor(dataDir: string, folders: readonly string[]) {
    for (const f of folders) {
      const w = loadWorld(dataDir, f)
      if (w && w.events.size > 0) {
        this.worlds.set(f, w)
        console.log(
          `[dataLoader] loaded ${f}: events ${w.events.size}, talents ${w.talents.size}, ` +
            `age nodes ${w.ages.size}, myths ${w.myths.length}, names ${w.names.length}`,
        )
      } else if (w) {
        console.warn(`[dataLoader] skipping empty world ${f} (no event data)`)
      }
    }
    if (this.worlds.size === 0) {
      console.warn(`[dataLoader] warning: no world data found in ${dataDir}, engine will have no content available`)
    }
    if (warnCount > 0) console.warn(`[dataLoader] ${warnCount} validation warning(s)`)
  }

  available(): string[] {
    return [...this.worlds.keys()]
  }

  has(folder: string): boolean {
    return this.worlds.has(folder)
  }

  get(folder: string): WorldData | undefined {
    return this.worlds.get(folder)
  }
}
