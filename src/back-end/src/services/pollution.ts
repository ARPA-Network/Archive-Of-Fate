import type { PollutionEntry, InscriptionEntry } from '../types'
import type { RNG } from '../engine/rng'

export class PollutionService {
  private pool: PollutionEntry[] = []
  constructor(private cap = 50) {}

  get size(): number {
    return this.pool.length
  }

  list(): PollutionEntry[] {
    return [...this.pool]
  }

  add(entry: PollutionEntry): void {
    this.pool.push(entry)
    while (this.pool.length > this.cap) this.pool.shift()
  }

  addFromInscription(e: InscriptionEntry): void {
    this.add({
      id: e.id,
      title: e.title,
      characterName: e.characterName,
      world: e.world,
      traits: e.traits,
      fateLevel: e.fateLevel,
      seed: e.seed,
      summary: e.summary,
      addedAt: e.inscribedAt,
    })
  }

  random(rng: RNG): PollutionEntry | null {
    if (this.pool.length === 0) return null
    return this.pool[Math.floor(rng() * this.pool.length)]
  }
}
