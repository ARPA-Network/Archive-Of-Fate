
type Handler = (args: any) => void

class EventBus {
  private map = new Map<string, Set<Handler>>()

  emit(name: string, args?: any): void {
    const set = this.map.get(name)
    if (!set) return
    ;[...set].forEach((h) => {
      try {
        h(args)
      } catch (e) {
        console.error(`[eventBus] handler error on "${name}"`, e)
      }
    })
  }

  on(name: string, handler: Handler): () => void {
    let set = this.map.get(name)
    if (!set) {
      set = new Set()
      this.map.set(name, set)
    }
    set.add(handler)
    return () => this.off(name, handler)
  }

  off(name: string, handler: Handler): void {
    this.map.get(name)?.delete(handler)
  }
}

export const eventBus = new EventBus()

export const $$event = (name: string, args?: any): void => eventBus.emit(name, args)
export const $$on = (name: string, handler: Handler): (() => void) => eventBus.on(name, handler)
export const $$off = (name: string, handler: Handler): void => eventBus.off(name, handler)
