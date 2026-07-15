import { Page } from '../ui/Page'
import { h, button } from '../ui/dom'
import { buildScreen } from '../ui/screen'
import { $ui, UI } from '../globals'
import { $lang } from '../i18n'

export class ThanksPage extends Page {
  readonly name = UI.pages.THANKS

  override init(): void {
    const safe = buildScreen(this.root, { decoBars: true })
    safe.append(
      button($lang.back, () => $ui.switchView(UI.pages.MAIN), 'btn--thin btn-back'),
      h('div', { class: 'screen-title txt', text: $lang.thanks_title, style: { top: '90px' } }),
      h('div', { class: 'thanks-body scroll txt', text: $lang.thanks_body }),
    )
  }
}
