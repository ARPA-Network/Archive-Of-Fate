
export type RNG = () => number

export function mulberry32(seed: number): RNG {
  let s = seed | 0
  return function (): number {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateSeed(): number {
  const min = 100000
  const max = 999999
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function weightedRandom<T>(candidates: Array<[T, number]>, rng: RNG): T {
  const total = candidates.reduce((acc, [, w]) => acc + w, 0)
  let r = rng() * total
  for (const [value, weight] of candidates) {
    r -= weight
    if (r < 0) return value
  }
  return candidates[candidates.length - 1][0]
}

export function randInt(rng: RNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}
