import type { WorldData, AgeNode } from './dataLoader'
import type { PropertyState } from './properties'
import type { ContentItem } from '../types'

export function formatTemplate(text: string | undefined, props: PropertyState): string {
  if (!text) return ''
  const year = new Date().getFullYear()
  return text.replace(/\{(\w+)\}/g, (m, key) => {
    switch (key) {
      case 'age': return String(props.AGE)
      case 'charm': return String(props.CHR)
      case 'intelligence': return String(props.INT)
      case 'strength': return String(props.STR)
      case 'money': return String(props.MNY)
      case 'spirit': return String(props.SPR)
      case 'currentYear': return String(year)
      default: return m 
    }
  })
}

export function filterCandidates(node: AgeNode, world: WorldData, props: PropertyState): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const { id, weight } of node.events) {
    const e = world.events.get(id)
    if (!e) continue
    if (e.NoRandom === 1) continue
    if (e.exclude && e._exclude(props)) continue
    if (e.include && !e._include(props)) continue
    out.push([id, weight])
  }
  return out
}

export function doEvent(
  world: WorldData,
  props: PropertyState,
  eventId: number,
  visited: Set<number> = new Set(),
): ContentItem[] {
  if (visited.has(eventId)) {
    console.error(`[events] branch loop at event ${eventId}, call chain ${[...visited].join('->')}`)
    return []
  }
  visited.add(eventId)

  const e = world.events.get(eventId)
  if (!e) return []

  props.effect(e.effect)
  props.change('EVT', eventId)

  const content: ContentItem = {
    type: 'EVT',
    description: formatTemplate(e.event, props),
    grade: e.grade,
  }
  const post = formatTemplate(e.postEvent, props)
  if (post) content.postEvent = post

  for (const b of e._branch) {
    if (b.cond(props)) {
      return [content, ...doEvent(world, props, b.next, visited)]
    }
  }
  return [content]
}
