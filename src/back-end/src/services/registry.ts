import type { InscriptionEntry } from '../types'

export class RegistryService {
  private entries: InscriptionEntry[] = []

  add(entry: InscriptionEntry): void {
    this.entries.push(entry)
  }

  list(): InscriptionEntry[] {
    return [...this.entries].sort((a, b) => b.inscribedAt - a.inscribedAt)
  }

  get(id: string): InscriptionEntry | undefined {
    return this.entries.find((e) => e.id === id)
  }

  get count(): number {
    return this.entries.length
  }

  seedOfficial(entries: InscriptionEntry[]): void {
    this.entries.push(...entries)
  }
}
