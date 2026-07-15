import { h, button } from '../ui/dom'
import type { DialogInstance } from '../ui/UIManager'
import { $lang, setLanguage } from '../i18n'
import { progression } from '../core/progression'

export class ThemesDialog implements DialogInstance {
  root: HTMLElement

  constructor() {
    const stage = document.getElementById('stage')!
    const currentTheme = progression.theme()
    const currentLang = progression.lang()

    const btnDefault = button(
      $lang.theme_default,
      () => {
        progression.setTheme('default')
        stage.setAttribute('data-theme', 'default')
      },
      currentTheme === 'default' ? 'btn-primary' : '',
    )
    const btnCyber = button($lang.theme_cyber, () => {}, 'btn-ghost')
    btnCyber.classList.add('disabled')

    const btnZh = button(
      $lang.lang_zh,
      () => this.switchLang('zh-cn'),
      currentLang === 'zh-cn' ? 'btn-cyan' : '',
    )
    const btnEn = button(
      $lang.lang_en,
      () => this.switchLang('en'),
      currentLang === 'en' ? 'btn-cyan' : '',
    )

    this.root = h('div', { class: 'dialog-box' }, [
      h('div', { class: 'dialog-title', text: $lang.themes_title }),
      h('div', { class: 'dialog-row' }, [btnDefault, btnCyber]),
      h('div', { class: 'dialog-sub', text: $lang.lang_switch }),
      h('div', { class: 'dialog-row' }, [btnZh, btnEn]),
      h('div', { class: 'dialog-row' }, [button($lang.confirm, () => window.$ui.closeTopDialog(), 'btn')]),
    ])
  }

  private switchLang(code: string): void {
    progression.setLang(code)
    setLanguage(code)
    window.$ui.closeTopDialog()
    window.$ui.switchView(window.$ui.currentPageName)
  }

  close(): void {}
}
