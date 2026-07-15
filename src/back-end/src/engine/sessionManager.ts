import { GameSession, type Services } from './session'
import { config } from '../config'

export class SessionManager {
  private sessions = new Map<string, GameSession>()
  private counter = 0

  constructor(private svc: Services) {
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref?.()
  }

  create(): GameSession {
    const id = `s_${Date.now().toString(36)}_${(this.counter++).toString(36)}`
    const session = new GameSession(id, this.svc)
    this.sessions.set(id, session)
    return session
  }

  get(id: string): GameSession | undefined {
    const s = this.sessions.get(id)
    if (s) s.touch()
    return s
  }

  remove(id: string): void {
    this.sessions.delete(id)
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [id, s] of this.sessions) {
      if (now - s.lastActive > config.sessionTtlMs) this.sessions.delete(id)
    }
  }

  get size(): number {
    return this.sessions.size
  }
}
