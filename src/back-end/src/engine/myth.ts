import type { WorldData, MythDef } from './dataLoader'
import type { PropertyState } from './properties'
import type { RNG } from './rng'
import { weightedRandom } from './rng'
import type { ContentItem } from '../types'
import type { PollutionService } from '../services/pollution'
import type { AIService } from '../services/aiService'

const POLLUTION_BASE_CHANCE = 1.0 
const RARITY_WEIGHT: Record<MythDef['rarity'], number> = {
  common: 10,
  uncommon: 5,
  rare: 2,
  legendary: 1,
}

export function deriveMythProbability(props: PropertyState): number {
  let chance = 0.03
  const age = props.AGE
  if (age >= 80) chance += 0.04
  else if (age >= 60) chance += 0.02
  if (['HCHR', 'HINT', 'HSTR', 'HMNY', 'HSPR'].some((h) => props.num(h) >= 10)) chance += 0.02
  if (props.SUM >= 110) chance += 0.03
  const tms = props.num('TMS')
  if (tms >= 50) chance += 0.02
  else if (tms >= 10) chance += 0.01
  return Math.min(chance, 0.15)
}

function buildRecentContext(eventLog: string[], maxChars = 200): string {
  const selected: string[] = []
  let chars = 0
  for (let i = eventLog.length - 1; i >= 0; i--) {
    const entry = eventLog[i]
    if (chars + entry.length > maxChars) break
    chars += entry.length
    selected.unshift(entry)
  }
  return selected.join('；')
}

export interface MythResult {
  content: ContentItem[]
  pollutionId: string | null
}

export function tryMyth(
  world: WorldData,
  props: PropertyState,
  rng: RNG,
  eventLog: string[],
  pollution: PollutionService,
  ai: AIService,
  instanceId: string,
  lang = 'zh-cn',
): MythResult {
  if (rng() > deriveMythProbability(props)) return { content: [], pollutionId: null }
  if (world.myths.length === 0) return { content: [], pollutionId: null }

  const template = weightedRandom(
    world.myths.map((m) => [m, RARITY_WEIGHT[m.rarity]] as [MythDef, number]),
    rng,
  )

  props.change('MYTHC', 1)
  props.effect(template.effect)

  let pollutionEntry = null
  let pollutionId: string | null = null
  if (pollution.size > 0 && rng() < POLLUTION_BASE_CHANCE) {
    pollutionEntry = pollution.random(rng)
    pollutionId = pollutionEntry?.id ?? null
  }

  const defaultFallback = lang.toLowerCase().startsWith('en')
    ? 'The threads of fate quietly intertwine in this moment…'
    : '命运之线在此刻悄然交织……'
  const description = ai.generateMythEvent(
    {
      worldText: world.worldText,
      recentEvents: buildRecentContext(eventLog),
      pollutionEntry,
      age: props.AGE,
      fallback: template.fallback ?? template.description ?? defaultFallback,
    },
    lang,
  )

  return {
    content: [{ type: 'myth_event', grade: template.grade, description, instanceId }],
    pollutionId,
  }
}
