import { Page, type PageArgs } from '../ui/Page'
import { h } from '../ui/dom'
import { buildScreen, asset } from '../ui/screen'
import { $ui, UI } from '../globals'
import { $lang, type LangKey } from '../i18n'
import { $$on } from '../core/eventBus'
import { delay } from '../core/utils'

export interface LoadingArgs {
  task?: () => Promise<void>
  next?: string
  nextArgs?: PageArgs
  errorNext?: string
  minMs?: number
}

export class LoadingPage extends Page {
  readonly name = UI.pages.LOADING

  override init(args?: LoadingArgs): void {
    const safe = buildScreen(this.root, { decoBars: true })
    const sub = h('div', { class: 'loading-sub txt', text: $lang.loading_tip })
    safe.append(
      h('img', { class: 'loading-gif', attrs: { src: asset('loading-gif.gif'), alt: 'Loading' } }),
      sub,
    )

    if (args?.task) {
      this.onDispose($$on('loading_status', (key: string) => { sub.textContent = $lang.t(key as LangKey) }))
    }

    if (!args || !args.task) {
      this.setTimeout(() => $ui.switchView(UI.pages.MAIN), 1400)
      return
    }

    const minMs = args.minMs ?? 700
    const run = async () => {
      try {
        await Promise.all([args.task!(), delay(minMs)])
      } catch (e) {
        console.error('[Loading] task error', e)
        if (args.errorNext) {
          const error = (e as Error)?.message
          this.setTimeout(() => $ui.switchView(args.errorNext!, { error }), 200)
          return
        }
      }
      this.setTimeout(() => $ui.switchView(args.next ?? UI.pages.MAIN, args.nextArgs), 200)
    }
    void run()
  }
}
