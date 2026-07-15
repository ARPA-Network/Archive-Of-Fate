import { UIManager } from './ui/UIManager'
import { Core } from './core/Core'
import { $lang } from './i18n'
import { $_ } from './core/utils'
import { $$event, $$on, $$off } from './core/eventBus'
import { Pages, Popups, Dialogs } from './core/enums'

export const $ui = new UIManager()
export const core = new Core()

export const UI = {
  pages: Pages,
  popups: Popups,
  dialogs: Dialogs,
}

declare global {
  interface Window {
    $ui: UIManager
    core: Core
    $lang: typeof $lang
    $_: typeof $_
    UI: typeof UI
    $$event: typeof $$event
    $$on: typeof $$on
    $$off: typeof $$off
  }
}

export function installGlobals(): void {
  window.$ui = $ui
  window.core = core
  window.$lang = $lang
  window.$_ = $_
  window.UI = UI
  window.$$event = $$event
  window.$$on = $$on
  window.$$off = $$off
}

export { $lang, $_, $$event, $$on, $$off }
