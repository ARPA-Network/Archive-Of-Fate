export interface PageArgs {
  [k: string]: any
}

export abstract class Page {
  root: HTMLElement
  private disposers: Array<() => void> = []

  constructor(extraClass = '') {
    this.root = document.createElement('div')
    this.root.className = `page ${extraClass}`.trim()
  }

  abstract readonly name: string

  static load(): string[] {
    return []
  }

  init(_args?: PageArgs): void | Promise<void> {}

  show(): void {}

  close(): void {
    this.disposers.forEach((d) => {
      try {
        d()
      } catch (e) {
        console.error('[Page.close] disposer error', e)
      }
    })
    this.disposers = []
  }

  protected onDispose(fn: () => void): void {
    this.disposers.push(fn)
  }

  protected setInterval(fn: () => void, ms: number): number {
    const id = window.setInterval(fn, ms)
    this.onDispose(() => window.clearInterval(id))
    return id
  }

  protected setTimeout(fn: () => void, ms: number): number {
    const id = window.setTimeout(fn, ms)
    this.onDispose(() => window.clearTimeout(id))
    return id
  }

  protected frameOnce(fn: () => void): void {
    const id = requestAnimationFrame(fn)
    this.onDispose(() => cancelAnimationFrame(id))
  }
}

export type PageClass = (new () => Page) & { load?: () => string[] }
