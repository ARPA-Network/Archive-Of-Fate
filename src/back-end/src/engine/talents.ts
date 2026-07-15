import type { WorldData, TalentDef } from './dataLoader'
import type { PropertyState } from './properties'
import type { ContentItem, TalentInfo, ReplacementLog, Grade } from '../types'
import { weightedRandom } from './rng'

const BASE_RATE: Record<Grade, number> = { 0: 100, 1: 10, 2: 1, 3: 0.5 }

export function toTalentInfo(t: TalentDef): TalentInfo {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    grade: t.grade,
    exclude: t.exclude,
    status: t.status,
    effect: t.effect,
  }
}

export function hasMutualExclusion(world: WorldData, a: number, b: number): boolean {
  const ta = world.talents.get(a)
  const tb = world.talents.get(b)
  return !!(ta?.exclude?.includes(b) || tb?.exclude?.includes(a))
}

export function excludesAny(world: WorldData, talentId: number, set: number[]): number | null {
  for (const x of set) {
    if (hasMutualExclusion(world, talentId, x)) return x
  }
  return null
}

function parseWeightEntry(entry: string | number): [number, number] {
  if (typeof entry === 'number') return [entry, 1]
  const [id, w] = String(entry).split('*')
  return [Number(id), w ? Number(w) : 1]
}

const nonSeeded = () => Math.random()

function replaceOne(world: WorldData, talentId: number, current: number[]): number {
  const t = world.talents.get(talentId)
  if (!t || !t.replacement) return talentId
  const candidates: Array<[number, number]> = []
  if (t.replacement.grade) {
    for (const g of t.replacement.grade) {
      for (const cand of world.talentList) {
        if (cand.grade === g && cand.exclusive !== 1 && excludesAny(world, cand.id, current) === null) {
          candidates.push([cand.id, 1])
        }
      }
    }
  }
  if (t.replacement.talent) {
    for (const entry of t.replacement.talent) {
      const [tid, w] = parseWeightEntry(entry)
      if (excludesAny(world, tid, current) === null) candidates.push([tid, w])
    }
  }
  if (candidates.length === 0) return talentId
  const chosen = weightedRandom(candidates, nonSeeded)
  return replaceOne(world, chosen, [...current, chosen])
}

export function expandReplacements(world: WorldData, talentIds: number[]): ReplacementLog[] {
  const logs: ReplacementLog[] = []
  const finalIds = [...talentIds]
  for (const id of talentIds) {
    const replaced = replaceOne(world, id, finalIds)
    if (replaced !== id) {
      logs.push({ from: id, to: replaced })
      finalIds.push(replaced)
    }
  }
  return logs
}

export function applyReplacements(talentIds: number[], logs: ReplacementLog[]): number[] {
  const map = new Map(logs.map((l) => [l.from, l.to]))
  return talentIds.map((id) => map.get(id) ?? id)
}

export function doTalent(world: WorldData, props: PropertyState, id: number): ContentItem | null {
  const t = world.talents.get(id)
  if (!t) return null
  props.effect(t.effect)
  return { type: 'TLT', name: t.name, description: t.description, grade: t.grade }
}

export function doTalents(
  world: WorldData,
  props: PropertyState,
  talentIds: number[],
  triggerCounts: Record<number, number>,
): ContentItem[] {
  const out: ContentItem[] = []
  for (const id of talentIds) {
    const t = world.talents.get(id)
    if (!t) continue
    if ((triggerCounts[id] ?? 0) >= t.maxTriggers) continue
    if (!t.condition || t._condition(props)) {
      const r = doTalent(world, props, id)
      if (r) {
        triggerCounts[id] = (triggerCounts[id] ?? 0) + 1
        out.push(r)
      }
    }
  }
  return out
}

export function drawTalents(world: WorldData, poolSize: number, gradeBonus: number): TalentInfo[] {
  const pool = world.talentList.filter((t) => t.exclusive !== 1)
  const used = new Set<number>()
  const result: TalentDef[] = []
  const weightFor = (g: Grade): number => {
    const base = BASE_RATE[g]
    return g >= 2 ? base * (1 + gradeBonus * 0.1) : base
  }
  let guard = 0
  while (result.length < poolSize && guard++ < 2000) {
    const candidates = pool.filter((t) => !used.has(t.id))
    if (candidates.length === 0) break
    const picked = weightedRandom(
      candidates.map((t) => [t, weightFor(t.grade)] as [TalentDef, number]),
      nonSeeded,
    )
    used.add(picked.id)
    result.push(picked)
  }
  return result.map(toTalentInfo)
}
