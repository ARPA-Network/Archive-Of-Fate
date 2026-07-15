import { Page } from '../ui/Page'
import { h, button } from '../ui/dom'
import { buildScreen, asset } from '../ui/screen'
import { $ui, core, UI } from '../globals'
import { $lang } from '../i18n'
import { ThemesDialog } from '../dialogs/ThemesDialog'
import { SaveLoadDialog } from '../dialogs/SaveLoadDialog'

export class MainPage extends Page {
  readonly name = UI.pages.MAIN

  override init(): void {
    const firstTime = core.times === 0
    const safe = buildScreen(this.root, {})

    safe.append(
      h('img', { class: 'main-bg', attrs: { src: asset('menu-bg.png'), alt: '' } }),
      h('img', { class: 'main-gif', attrs: { src: asset('menu-dna.gif'), alt: '' } }),
    )

    safe.append(h('div', { class: 'main-title txt', text: `- ${$lang.app_title} -` }))

    safe.append(
      button(firstTime ? $lang.btn_start_game : $lang.btn_remake, () => $ui.switchView(UI.pages.CONNECT_WALLET), 'btn main-start'),
    )

    safe.append(
      h('div', { class: 'main-corner main-topnav' }, [
        button($lang.btn_archive, () => $ui.switchView(UI.pages.WORLD_BOARD), 'btn--thin'),
        button($lang.btn_thanks, () => $ui.switchView(UI.pages.THANKS), 'btn--thin'),
      ]),
    )

    const linkButtons: HTMLElement[] = []
    const telegramUrl = import.meta.env.VITE_TELEGRAM_URL
    const githubUrl = import.meta.env.VITE_GITHUB_URL
    if (telegramUrl) {
      const telegram = h('a', {
        class: 'btn btn--thin link-icon-btn',
        attrs: { href: telegramUrl, target: '_blank', rel: 'noopener noreferrer', title: $lang.btn_telegram },
      })
      telegram.append(
        h('img', { attrs: { src: asset('telegram-icon.svg'), alt: $lang.btn_telegram } }),
        h('span', { text: $lang.btn_telegram }),
      )
      linkButtons.push(telegram)
    }
    if (githubUrl) {
      const github = h('a', {
        class: 'btn btn--thin link-icon-btn',
        attrs: { href: githubUrl, target: '_blank', rel: 'noopener noreferrer', title: $lang.btn_github },
      })
      github.append(
        h('img', { attrs: { src: asset('github-icon.svg'), alt: $lang.btn_github } }),
        h('span', { text: $lang.btn_github }),
      )
      linkButtons.push(github)
    }
    if (linkButtons.length) {
      safe.append(h('div', { class: 'main-corner main-topnav-left' }, linkButtons))
    }

    const achv = button($lang.btn_achievement, () => $ui.switchView(UI.pages.ACHIEVEMENT), 'btn--thin main-sub-btn main-achv')
    const lang = button('', () => $ui.openDialog(new ThemesDialog()), 'btn--thin main-sub-btn main-lang')
    lang.appendChild(h('img', { attrs: { src: asset('lang-icon.svg'), alt: 'lang' } }))
    safe.append(achv, lang)

    if (firstTime) achv.style.display = 'none'
    this.bindSaveLoadShortcut(safe)
  }

  private bindSaveLoadShortcut(safe: HTMLElement): void {
    const title = safe.querySelector('.main-title') as HTMLElement | null
    if (title) {
      title.style.cursor = 'pointer'
      title.addEventListener('dblclick', () => $ui.openDialog(new SaveLoadDialog()))
    }
  }
}
